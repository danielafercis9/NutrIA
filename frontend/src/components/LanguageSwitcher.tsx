import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pillBtn = (code: Lang, label: string) => (
    <button
      key={code}
      onClick={() => setLang(code)}
      className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-300 ${
        lang === code
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/60 hover:text-foreground"
      }`}
      aria-pressed={lang === code}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className="fixed top-3 right-3 z-50">
      {/* Desktop pill */}
      <div className="hidden sm:flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-full px-1 py-1 shadow-md border border-border/40">
        {pillBtn("en", "EN")}
        <span className="text-foreground/20 text-xs select-none">|</span>
        {pillBtn("es", "ES")}
      </div>

      {/* Mobile globe */}
      <div className="sm:hidden relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-9 h-9 rounded-full bg-card/90 backdrop-blur-sm shadow-md border border-border/40 flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
          aria-label="Change language"
        >
          <Globe size={16} />
        </button>
        {open && (
          <div className="absolute top-11 right-0 bg-card rounded-2xl shadow-lg border border-border/40 p-1 flex flex-col min-w-[80px] animate-fade-in">
            {(["en", "es"] as Lang[]).map((code) => (
              <button
                key={code}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-xl text-left transition-colors ${
                  lang === code
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-muted"
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
