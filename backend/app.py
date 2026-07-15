from fastapi import FastAPI
from pydantic import BaseModel

from NutrIA_API import (
    preprocess_query,
    search_pubmed,
    fetch_abstracts,
    get_relevant_context,
    ask,
    broaden_query
)

app = FastAPI()

class Query(BaseModel):
    question: str


@app.post("/ask")
def ask_question(query: Query):
    user_query = query.question

    search_query = preprocess_query(user_query)
    pubmed_ids = search_pubmed(search_query)

    if not pubmed_ids:
        search_query = broaden_query(search_query)
        pubmed_ids = search_pubmed(search_query)

    if not pubmed_ids:
        return {"answer": "No results found"}

    articles = fetch_abstracts(pubmed_ids)
    top_articles = get_relevant_context(search_query, articles)
    answer = ask(user_query, top_articles)

    return {
        "answer": answer,
        "sources": [
            {
                "pmid": art["pmid"],
                "title": art["title"]
            }
            for art in top_articles
        ]
    }
    
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # or ["https://id-preview--1dc6ea1a-e91a-4c09-ab53-dbc8edaf3599.lovable.app"]
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],          # must include ngrok-skip-browser-warning + content-type
)
