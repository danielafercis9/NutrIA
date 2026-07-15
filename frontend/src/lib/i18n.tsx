import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "es";

type Dict = Record<string, string>;

const translations: Record<Lang, Dict> = {
  en: {
    "app.tagline": "Answers grounded in peer-reviewed PubMed literature",
    "input.placeholder": "Ask a nutrition or health question...",
    "welcome.title": "Hi! I'm NutrIA 👋",
    "welcome.body":
      "I'm your science-based nutrition assistant. Ask me anything about nutrition and I'll search the latest biomedical research to give you evidence-backed answers.",
    "loading.text": "NutrIA is searching scientific literature",
    "noevidence.text": "I couldn't find enough scientific evidence for that 🦦",
    "error.text": "Oops! I couldn't reach the knowledge base. Try again.",
    "error.retry": "Retry",
    "sources.title": "SOURCES",
    "example.1": "What are the benefits of omega-3 fatty acids?",
    "example.2": "Is intermittent fasting effective for weight loss?",
    "example.3": "How does vitamin D affect immunity?",
    "example.4": "What foods help reduce inflammation?",
    "logo.tooltip": "Back to Home",
  },
  es: {
    "app.tagline": "Respuestas basadas en literatura científica de PubMed",
    "input.placeholder": "Haz una pregunta sobre nutrición o salud...",
    "welcome.title": "¡Hola! Soy NutrIA 👋",
    "welcome.body":
      "Soy tu asistente de nutrición basado en ciencia. Pregúntame lo que quieras sobre nutrición y buscaré las últimas investigaciones biomédicas para darte respuestas con evidencia.",
    "loading.text": "NutrIA está buscando en la literatura científica",
    "noevidence.text": "No encontré suficiente evidencia científica sobre eso 🦦",
    "error.text": "¡Ups! No pude conectar con la base de conocimiento. Inténtalo de nuevo.",
    "error.retry": "Reintentar",
    "sources.title": "FUENTES",
    "example.1": "¿Cuáles son los beneficios de los ácidos grasos omega-3?",
    "example.2": "¿El ayuno intermitente es eficaz para perder peso?",
    "example.3": "¿Cómo afecta la vitamina D a la inmunidad?",
    "example.4": "¿Qué alimentos ayudan a reducir la inflamación?",
    "logo.tooltip": "Volver al inicio",
  },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function detectInitial(): Lang {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("nutria-lang") as Lang | null;
  if (stored === "en" || stored === "es") return stored;
  const nav = navigator.language?.toLowerCase() ?? "";
  return nav.startsWith("es") ? "es" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setLangState(detectInitial());
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("nutria-lang", l);
  };

  const t = (key: string) => translations[lang][key] ?? translations.en[key] ?? key;

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
