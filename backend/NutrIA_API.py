import os
import re
import sys
import time
import textwrap
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
import numpy as np
from sentence_transformers import SentenceTransformer
from groq import Groq, AuthenticationError, RateLimitError, APIConnectionError, APIStatusError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH_URL  = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

MAX_PUBMED_RESULTS = 20      # abstracts retrieved from PubMed
TOP_K              = 5       # top abstracts sent to LLM
EMBEDDING_MODEL    = "all-MiniLM-L6-v2"        # fast, CPU-friendly (~80 MB)
LLM_MODEL          = "llama-3.3-70b-versatile"  # free on Groq, highly capable
MAX_TOKENS         = 1024

# Reuse the embedding model across calls (loaded once at module level)
print("Loading embedding model")
_embedder = SentenceTransformer(EMBEDDING_MODEL)
print("Embedding model ready.\n")

# ---------------------------------------------------------------------------
# Query preprocessing
# ---------------------------------------------------------------------------

def preprocess_query(user_query: str) -> str:
    """
    Convert everyday questions into a short English PubMed search query.

    Groq handles casual wording, typos, and Spanish/English translation. A small
    local fallback is kept so the app still works if the LLM call fails.
    """
    query = " ".join(user_query.strip().split())
    if not query:
        return query

    llm_query = preprocess_query_with_llm(query)
    if llm_query:
        return llm_query

    return preprocess_query_fallback(query)


def preprocess_query_with_llm(user_query: str) -> str:
    """Use Groq to rewrite a user question into a concise PubMed query."""
    api_key = GROQ_API_KEY.strip()
    if not api_key or api_key == "gsk_...":
        return ""

    system_prompt = textwrap.dedent("""\
        You rewrite health and nutrition questions into PubMed search queries.

        Return ONLY the search query. No explanation. No punctuation.
        Rules:
        - Translate Spanish or other languages to English.
        - Correct obvious spelling mistakes.
        - Keep only the core biomedical concepts: food/exposure/intervention,
          outcome, and population when present.
        - Use standard biomedical wording when useful.
        - Keep it short: 2 to 6 words.
        - Remove conversational words like should, can, give, get, good, bad.

    """)

    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            model=LLM_MODEL,
            max_tokens=32,
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query},
            ],
        )
        rewritten = chat_completion.choices[0].message.content.strip()
    except (AuthenticationError, RateLimitError, APIConnectionError, APIStatusError, Exception):
        return ""

    return clean_search_query(rewritten)


def clean_search_query(search_query: str) -> str:
    """Sanitize the LLM rewrite before sending it to PubMed."""
    search_query = search_query.strip().strip('"\'`')
    search_query = re.sub(r"^(query|search query)\s*:\s*", "", search_query, flags=re.I)
    search_query = re.sub(r"[^a-zA-Z0-9\s-]", " ", search_query)
    search_query = " ".join(search_query.split())

    # Keep runaway responses from turning into over-specific PubMed searches.
    return " ".join(search_query.split()[:6])


def preprocess_query_fallback(user_query: str) -> str:
    """Small backup cleaner used only if Groq cannot rewrite the query."""
    words = re.findall(r"[a-zA-Z]+", user_query.lower())

    replacements = {
        "cigarretes": "cigarette",
        "cigarettes": "cigarette",
        "intermitent": "intermittent",
        "interminent": "intermittent",
        "eggs": "egg",
        "smoke": "smoking",
        "kids": "children",
        "kid": "children",
        "child": "children",
    }
    stop_words = {
        "a", "an", "and", "are", "bad", "be", "can", "could", "do", "does",
        "for", "from", "get", "give", "good", "have", "i", "if", "is", "it",
        "my", "of", "ok", "okay", "on", "our", "please", "safe", "should", "the",
        "to", "too", "much", "we", "while", "with", "would",
    }

    terms = []
    for word in words:
        word = replacements.get(word, word)
        if word not in stop_words:
            terms.append(word)

    terms = list(dict.fromkeys(terms))
    return " ".join(terms[:6]) or user_query


def broaden_query(search_query: str) -> str:
    """Return a simpler fallback query if the first PubMed search is too narrow."""
    terms = search_query.split()
    population_terms = {"children", "child", "pediatric", "infant", "adolescent"}
    broader_terms = [term for term in terms if term.lower() not in population_terms]
    if 1 <= len(broader_terms) < len(terms):
        return " ".join(broader_terms)
    if len(terms) > 2:
        return " ".join(terms[:2])
    return search_query

# 1. search_pubmed
# ---------------------------------------------------------------------------

def search_pubmed(query: str, max_results: int = MAX_PUBMED_RESULTS) -> list[str]:
    """
    Query PubMed via the NCBI E-utilities API and return a list of PubMed IDs.

    Parameters
    ----------
    query       : free-text biomedical query
    max_results : maximum number of article IDs to retrieve

    Returns
    -------
    List of PubMed ID strings; empty list on failure.
    """
    params = {
        "db":      "pubmed",
        "term":    query,
        "retmax":  max_results,
        "retmode": "json",
        "sort":    "relevance",
    }

    try:
        response = requests.get(PUBMED_SEARCH_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        id_list = data.get("esearchresult", {}).get("idlist", [])

        if not id_list:
            print("⚠️  No PubMed results found for that query.")
        return id_list

    except requests.exceptions.Timeout:
        print("❌  PubMed search timed out. Check your internet connection.")
        return []
    except requests.exceptions.RequestException as exc:
        print(f"❌  PubMed search error: {exc}")
        return []
    except (KeyError, ValueError) as exc:
        print(f"❌  Unexpected PubMed response format: {exc}")
        return []


# ---------------------------------------------------------------------------
# 2. fetch_abstracts
# ---------------------------------------------------------------------------

def fetch_abstracts(pubmed_ids: list[str]) -> list[dict]:
    """
    Fetch and clean article abstracts from PubMed given a list of IDs.

    Parameters
    ----------
    pubmed_ids : list of PubMed ID strings

    Returns
    -------
    List of dicts with keys: 'pmid', 'title', 'abstract'
    Articles without usable abstracts are silently skipped.
    """
    if not pubmed_ids:
        return []

    params = {
        "db":      "pubmed",
        "id":      ",".join(pubmed_ids),
        "rettype": "abstract",
        "retmode": "xml",
    }

    try:
        # NCBI recommends a small delay between requests
        time.sleep(0.35)
        response = requests.get(PUBMED_FETCH_URL, params=params, timeout=30)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        print("❌  Abstract fetch timed out.")
        return []
    except requests.exceptions.RequestException as exc:
        print(f"❌  Abstract fetch error: {exc}")
        return []

    # --- Parse XML ----------------------------------------------------------
    articles = []
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        print(f"❌  XML parse error: {exc}")
        return []

    for article_node in root.findall(".//PubmedArticle"):
        # PMID
        pmid_node = article_node.find(".//PMID")
        pmid = pmid_node.text.strip() if pmid_node is not None else "N/A"

        # Title
        title_node = article_node.find(".//ArticleTitle")
        title = "".join(title_node.itertext()).strip() if title_node is not None else ""

        # Abstract (may contain multiple <AbstractText> sections)
        abstract_nodes = article_node.findall(".//AbstractText")
        abstract_parts = []
        for node in abstract_nodes:
            label = node.get("Label")
            text  = "".join(node.itertext()).strip()
            if text:
                abstract_parts.append(f"{label}: {text}" if label else text)

        abstract = " ".join(abstract_parts).strip()

        if abstract:                          # skip articles with no abstract
            articles.append({
                "pmid":     pmid,
                "title":    title,
                "abstract": abstract,
            })

    if not articles:
        print("⚠️  Fetched articles but none contained usable abstracts.")

    return articles


# ---------------------------------------------------------------------------
# 3. get_relevant_context
# ---------------------------------------------------------------------------

def get_relevant_context(query: str, articles: list[dict], top_k: int = TOP_K) -> list[dict]:
    """
    Rank articles by semantic similarity to the query and return the top-k.

    Uses cosine similarity between Sentence-Transformer embeddings.

    Parameters
    ----------
    query    : the user's biomedical question
    articles : list of dicts from fetch_abstracts()
    top_k    : number of top articles to return

    Returns
    -------
    List of up to top_k article dicts, sorted by descending similarity.
    Each dict gains a 'score' key with the cosine similarity value.
    """
    if not articles:
        return []

    # Encode query and all abstracts in one batch (efficient on CPU)
    texts      = [art["abstract"] for art in articles]
    embeddings = _embedder.encode([query] + texts, convert_to_numpy=True,
                                  show_progress_bar=False)

    query_vec    = embeddings[0]
    abstract_vecs = embeddings[1:]

    # Cosine similarity: dot product of L2-normalised vectors
    query_norm     = query_vec / (np.linalg.norm(query_vec) + 1e-10)
    abstract_norms = abstract_vecs / (
        np.linalg.norm(abstract_vecs, axis=1, keepdims=True) + 1e-10
    )
    scores = abstract_norms @ query_norm

    # Attach scores and sort
    for art, score in zip(articles, scores):
        art["score"] = float(score)

    ranked = sorted(articles, key=lambda x: x["score"], reverse=True)
    return ranked[:top_k]


# ---------------------------------------------------------------------------
# 4. ask
# ---------------------------------------------------------------------------

def ask(query: str, relevant_articles: list[dict]) -> str:
    """
    Send the user query + retrieved context to a Groq-hosted LLM and return
    the grounded answer.

    Parameters
    ----------
    query             : the user's original question
    relevant_articles : top-ranked article dicts from get_relevant_context()

    Returns
    -------
    Answer string from the LLM, grounded solely in the provided context.
    """
    if not relevant_articles:
        return (
            "Insufficient information — no relevant biomedical abstracts "
            "were found for your query. Please try rephrasing or using "
            "different keywords."
        )

    # Build the context block
    context_blocks = []
    for i, art in enumerate(relevant_articles, 1):
        block = (
            f"[Article {i} | PMID: {art['pmid']} | Relevance: {art['score']:.2f}]\n"
            f"Title: {art['title']}\n"
            f"Abstract: {art['abstract']}"
        )
        context_blocks.append(block)

    context_text = "\n\n---\n\n".join(context_blocks)

    system_prompt = textwrap.dedent("""\
        You are a helpful biomedical assistant.

        Rules you MUST follow:
        1. Answer ONLY using information found in the provided context (PubMed abstracts).
        2. If the context does not contain enough information to answer the question,
           respond exactly with: "Insufficient information"
        3. Write in plain, clear English that someone without a science background
           can understand — avoid or briefly explain technical jargon.
        4. Be concise: aim for 3–6 sentences unless detail is essential.
        5. Do NOT invent facts, cite studies not in the context, or give
           personal medical advice.
        6. If the user asks a practical question, answer the general evidence
           behind it instead of giving an individualized instruction.
    """)

    user_message = (
        f"Context (retrieved PubMed abstracts):\n\n{context_text}\n\n"
        f"Question: {query}"
    )

    api_key = GROQ_API_KEY.strip()
    if not api_key or api_key == "gsk_...":
        return (
            "Paste the API key into the GROQ_API_KEY environment variable "
        )

    try:
        client = Groq(api_key=api_key)
        chat_completion = client.chat.completions.create(
            model      = LLM_MODEL,
            max_tokens = MAX_TOKENS,
            messages   = [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
        )
        return chat_completion.choices[0].message.content.strip()

    except AuthenticationError:
        return "Invalid Groq API key. Please check GROQ_API_KEY."
    except RateLimitError:
        return "Groq rate limit reached. Please wait a moment and try again."
    except APIConnectionError:
        return "Could not connect to the Groq API. Check your internet connection."
    except APIStatusError as exc:
        return f"Groq API error {exc.status_code}: {exc.message}"


# ---------------------------------------------------------------------------
# Main interactive loop
# ---------------------------------------------------------------------------

def main():
    banner = textwrap.dedent("""\
        ╔══════════════════════════════════════════════════════════╗
        ║    Biomedical RAG Chatbot  (PubMed + Groq — FREE)       ║
        ║  Ask any biomedical question. Type 'quit' to exit.      ║
        ╚══════════════════════════════════════════════════════════╝
    """)
    print(banner)

    while True:
        try:
            query = input("Your question: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not query:
            print("Please enter a question.\n")
            continue

        if query.lower() in {"quit", "exit", "q"}:
            print("Goodbye")
            break

        search_query = preprocess_query(query)
        if search_query != query:
            print(f"\nSearching PubMed for: {search_query}")
        else:
            print("\nSearching PubMed…")
        pubmed_ids = search_pubmed(search_query)

        if not pubmed_ids:
            fallback_query = broaden_query(search_query)
            if fallback_query != search_query:
                print(f"No exact matches. Trying broader search: {fallback_query}")
                pubmed_ids = search_pubmed(fallback_query)
                if pubmed_ids:
                    search_query = fallback_query

        if not pubmed_ids:
            print("No results from PubMed. Try a different query.\n")
            continue

        print(f"Fetching abstracts for {len(pubmed_ids)} article(s)…")
        articles = fetch_abstracts(pubmed_ids)

        if not articles:
            print("ℹCould not retrieve any usable abstracts.\n")
            continue

        print(f"Ranking {len(articles)} abstract(s) by semantic relevance…")
        top_articles = get_relevant_context(search_query, articles, top_k=TOP_K)

        print(f"\nTop {len(top_articles)} relevant abstract(s) selected:")
        for i, art in enumerate(top_articles, 1):
            print(f"   {i}. [PMID {art['pmid']}] {art['title'][:80]}…  "
                  f"(score: {art['score']:.2f})")

        print("\nGenerating answer…\n")
        answer = ask(query, top_articles)

        print("─" * 64)
        print("Answer:\n")
        # Wrap long lines for readability in a terminal
        for line in answer.splitlines():
            print(textwrap.fill(line, width=72) if line else "")
        print("─" * 64 + "\n")


if __name__ == "__main__":
    main()







