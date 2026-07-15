import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import otterImg from "@/assets/nutria_talking.png";
import logoImg from "@/assets/textologo.png";
import veggieBorderImg from "@/assets/veggie-border.png";
import tomatoesImg from "@/assets/tomatoes-deco.png";
import peppersImg from "@/assets/peppers-deco.png";
import { useI18n } from "@/lib/i18n";

interface Source {
  pmid: string;
  title: string;
}

interface ChatState {
  status: "idle" | "loading" | "success" | "error" | "no-evidence";
  question?: string;
  answer?: string;
  sources?: Source[];
}

const EXAMPLE_KEYS = ["example.1", "example.2", "example.3", "example.4"];

// Veggie palette colors for rotating user bubbles
const VEGGIE_COLORS = [
  "bg-veggie-leaf",
  "bg-veggie-tomato",
  "bg-veggie-carrot",
  "bg-veggie-pepper",
  "bg-veggie-broccoli",
  "bg-veggie-eggplant",
];

function parseAnswer(text: string) {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const bulletMatch = line.match(/^[\-\*•]\s*(.*)/);
      if (bulletMatch) {
        return { type: "bullet" as const, content: bulletMatch[1], key: i };
      }
      return { type: "paragraph" as const, content: line, key: i };
    });
}

function SourceCard({ source }: { source: Source }) {
  return (
    <motion.a
      href={`https://pubmed.ncbi.nlm.nih.gov/${source.pmid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl bg-source-card p-3 transition-shadow hover:shadow-[var(--shadow-card-hover)] border border-border/50"
      whileHover={{ scale: 1.01 }}
    >
      <p className="text-sm font-semibold text-source-card-foreground leading-snug">
        {source.title}
      </p>
      <p className="text-xs text-muted-foreground mt-1">PMID: {source.pmid}</p>
    </motion.a>
  );
}

export default function NutriaChat() {
  const { t } = useI18n();
  const [chat, setChat] = useState<ChatState>({ status: "idle" });
  const [input, setInput] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resetToHome = useCallback(() => {
    setChat({ status: "idle" });
    setInput("");
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const askQuestion = useCallback(
    async (question: string) => {
      setInput("");
      setChat({ status: "loading", question });
      setMsgIndex((prev) => prev + 1);

      try {
        const res = await fetch("https://ointment-lining-deplored.ngrok-free.dev/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ question }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();

        if (
          data.answer?.toLowerCase().includes("insufficient information") ||
          data.answer?.toLowerCase().includes("no sufficient")
        ) {
          setChat({ status: "no-evidence", question });
        } else {
          setChat({
            status: "success",
            question,
            answer: data.answer,
            sources: data.sources,
          });
        }
      } catch {
        setChat({ status: "error", question });
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    askQuestion(input.trim());
  };

  const currentBubbleColor = VEGGIE_COLORS[msgIndex % VEGGIE_COLORS.length];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden relative">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT PANEL */}
        <div className="hidden md:flex w-[38%] flex-col items-center justify-between py-6 px-6 relative">
          {/* Subtle bg decoration */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 70%, oklch(0.55 0.15 145) 0%, transparent 50%),
                                radial-gradient(circle at 70% 30%, oklch(0.72 0.16 55) 0%, transparent 50%)`,
            }}
          />

          {/* Logo */}
          <div className="z-10 flex-shrink-0">
            <button
              type="button"
              onClick={resetToHome}
              title={t("logo.tooltip")}
              aria-label={t("logo.tooltip")}
              className="cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
            >
              <img src={logoImg} alt="NutrIA" className="h-12 w-auto" />
            </button>
          </div>

          {/* Tomatoes deco - top left */}
          <img
            src={tomatoesImg}
            alt=""
            className="absolute top-4 left-2 w-24 opacity-80 pointer-events-none z-0"
            loading="lazy"
          />

          {/* Peppers deco - top right area */}
          <img
            src={peppersImg}
            alt=""
            className="absolute bottom-28 right-2 w-20 opacity-70 pointer-events-none z-0"
            loading="lazy"
          />

          {/* Otter */}
          <div className="z-10 flex-1 flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-3xl bg-primary/15 scale-110" />
              <motion.img
                src={otterImg}
                alt="NutrIA Otter Assistant"
                className="relative w-56 h-auto drop-shadow-lg animate-float"
              />
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="z-10 w-full max-w-sm flex-shrink-0">
            <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2.5 shadow-[var(--shadow-card)] border border-border/60 focus-within:shadow-[0_0_0_3px_var(--glow-primary)] transition-shadow">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("input.placeholder")}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground font-body"
                disabled={chat.status === "loading"}
              />
              <button
                type="submit"
                disabled={!input.trim() || chat.status === "loading"}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {t("app.tagline")}
            </p>
          </form>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col h-full p-4 md:p-5 md:pl-2 min-h-0">
          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 mb-3 flex-shrink-0">
            <button
              type="button"
              onClick={resetToHome}
              title={t("logo.tooltip")}
              aria-label={t("logo.tooltip")}
              className="cursor-pointer transition-transform duration-300 ease-out hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
            >
              <img src={logoImg} alt="NutrIA" className="h-8 w-auto" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col">
            {/* User message bubble */}
            <AnimatePresence>
              {chat.question && (
                <motion.div
                  key={"user-msg-" + msgIndex}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="self-end mb-3 flex-shrink-0"
                >
                  <div
                    className={`${currentBubbleColor} text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-md shadow-[var(--shadow-bubble)]`}
                  >
                    <p className="text-sm">{chat.question}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {/* IDLE: Welcome card */}
              {chat.status === "idle" && (
                <motion.div
                  key="welcome"
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="bg-card rounded-3xl p-7 max-w-lg w-full shadow-[var(--shadow-card)] border border-border/40">
                    <h1 className="text-2xl font-bold font-display text-foreground">
                      {t("welcome.title")}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {t("welcome.body")}
                    </p>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {EXAMPLE_KEYS.map((key, i) => {
                        const q = t(key);
                        return (
                          <button
                            key={key}
                            onClick={() => askQuestion(q)}
                            className={`text-left text-sm px-4 py-3 rounded-xl transition-colors border border-border/30 hover:opacity-80`}
                            style={{
                              backgroundColor: `color-mix(in oklch, var(--${
                                ["veggie-leaf", "veggie-tomato", "veggie-carrot", "veggie-pepper"][i]
                              }) 15%, var(--card))`,
                            }}
                          >
                            {q}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* LOADING */}
              {chat.status === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 flex items-start pt-2"
                >
                  <div className="relative max-w-md">
                    <div className="absolute left-0 top-5 -translate-x-2 w-4 h-4 bg-bubble-assistant rotate-45 rounded-sm hidden md:block" />
                    <div className="bg-bubble-assistant rounded-2xl px-6 py-5 shadow-[var(--shadow-card)] md:ml-2">
                      <p className="text-sm text-bubble-assistant-foreground animate-dots">
                        {t("loading.text")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* NO EVIDENCE */}
              {chat.status === "no-evidence" && (
                <motion.div
                  key="no-evidence"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 flex items-start pt-2"
                >
                  <div className="relative max-w-md">
                    <div className="absolute left-0 top-5 -translate-x-2 w-4 h-4 bg-bubble-assistant rotate-45 rounded-sm hidden md:block" />
                    <div className="bg-bubble-assistant rounded-2xl px-6 py-5 shadow-[var(--shadow-card)] md:ml-2">
                      <p className="text-sm text-bubble-assistant-foreground">
                        {t("noevidence.text")}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ERROR */}
              {chat.status === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 flex items-start pt-2"
                >
                  <div className="relative max-w-md">
                    <div className="absolute left-0 top-5 -translate-x-2 w-4 h-4 bg-bubble-assistant rotate-45 rounded-sm hidden md:block" />
                    <div className="bg-bubble-assistant rounded-2xl px-6 py-5 shadow-[var(--shadow-card)] md:ml-2">
                      <p className="text-sm text-destructive">
                        {t("error.text")}
                      </p>
                      <button
                        onClick={() => chat.question && askQuestion(chat.question)}
                        className="mt-3 text-xs text-primary font-semibold hover:underline"
                      >
                        {t("error.retry")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SUCCESS */}
              {chat.status === "success" && chat.answer && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1"
                >
                  <div className="relative max-w-2xl">
                    {/* Speech bubble tail */}
                    <div className="absolute left-0 top-5 -translate-x-2 w-4 h-4 bg-bubble-assistant rotate-45 rounded-sm hidden md:block" />

                    <div className="bg-bubble-assistant rounded-2xl px-5 py-4 shadow-[var(--shadow-card)] md:ml-2 overflow-y-auto max-h-[calc(100vh-200px)]">
                      {/* Answer */}
                      <div className="text-bubble-assistant-foreground">
                        {parseAnswer(chat.answer).map((block) =>
                          block.type === "bullet" ? (
                            <div key={block.key} className="flex items-start gap-2 my-1">
                              <span className="text-primary mt-1 text-xs">●</span>
                              <span className="text-sm leading-relaxed">{block.content}</span>
                            </div>
                          ) : (
                            <p key={block.key} className="text-sm leading-relaxed my-2">
                              {block.content}
                            </p>
                          )
                        )}
                      </div>

                      {/* Sources */}
                      {chat.sources && chat.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 font-display">
                            {t("sources.title")}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {chat.sources.map((s) => (
                              <SourceCard key={s.pmid} source={s} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile input */}
          <form onSubmit={handleSubmit} className="md:hidden mt-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2.5 shadow-[var(--shadow-card)] border border-border/60 focus-within:shadow-[0_0_0_3px_var(--glow-primary)] transition-shadow">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("input.placeholder")}
                className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                disabled={chat.status === "loading"}
              />
              <button
                type="submit"
                disabled={!input.trim() || chat.status === "loading"}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* BOTTOM VEGGIE FOOTER ACCENT */}
      <div className="flex-shrink-0 w-full h-5 md:h-7 relative overflow-hidden pointer-events-none">
        <img
          src={veggieBorderImg}
          alt=""
          className="w-full h-full object-cover object-center opacity-40"
          loading="lazy"
        />
        {/* Soft fade overlay so it blends into background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, var(--background) 0%, color-mix(in oklch, var(--background) 60%, transparent) 60%, transparent 100%)",
          }}
        />
      </div>
    </div>
  );
}
