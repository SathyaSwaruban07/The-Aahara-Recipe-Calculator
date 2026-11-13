import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import taContent from "./content/ta.json";
import hiContent from "./content/hi.json";

type Lang = "en" | "ta" | "hi";

type Dictionary = Record<string, string>;

const STATIC: Record<Exclude<Lang, "en">, Dictionary> = {
  ta: taContent,
  hi: hiContent,
};

const STORAGE_KEY = "recipe-proportions-translations-v1";

function loadPersisted(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function persist(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function cacheKey(source: Lang, target: Lang, text: string) {
  return `${source}|${target}|${text}`;
}

function normalizeLang(lng: string): Lang {
  if (lng.startsWith("ta")) return "ta";
  if (lng.startsWith("hi")) return "hi";
  return "en";
}

interface Ctx {
  lang: Lang;
  tContent: (text: string) => string;
  tMany: (texts: string[]) => string[];
  ready: boolean;
}

const ContentTranslationContext = createContext<Ctx | null>(null);

export function ContentTranslationProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);
  const [version, setVersion] = useState(0);
  const memory = useRef<Record<string, string>>(loadPersisted());
  const inflight = useRef<Set<string>>(new Set());
  const failed = useRef<Set<string>>(new Set());
  const queue = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookupStatic = useCallback((text: string, target: Lang) => {
    if (target === "en" || !text.trim()) return text;
    return STATIC[target][text];
  }, []);

  const flush = useCallback(async () => {
    const target = normalizeLang(i18n.language);
    if (target === "en") {
      queue.current.clear();
      return;
    }

    const pending = [...queue.current].filter((text) => {
      const key = cacheKey("en", target, text);
      if (inflight.current.has(key) || failed.current.has(key)) return false;
      if (lookupStatic(text, target)) return false;
      const cached = memory.current[key];
      if (cached && cached.trim() !== text.trim()) return false;
      return true;
    });
    queue.current.clear();
    if (!pending.length) return;

    const unique = [...new Set(pending.map((t) => t.trim()).filter(Boolean))];
    for (const text of unique) inflight.current.add(cacheKey("en", target, text));

    try {
      const { translations } = await api.translateBatch(unique, target, "en");
      unique.forEach((text, i) => {
        const key = cacheKey("en", target, text);
        const translated = (translations[i] || "").trim();
        if (translated && translated !== text.trim()) {
          memory.current[key] = translated;
          failed.current.delete(key);
        } else {
          // Don't keep hammering dead translate APIs for the same string
          delete memory.current[key];
          failed.current.add(key);
        }
        inflight.current.delete(key);
      });
      persist(memory.current);
      setVersion((v) => v + 1);
    } catch {
      for (const text of unique) {
        const key = cacheKey("en", target, text);
        inflight.current.delete(key);
        failed.current.add(key);
      }
    }
  }, [i18n.language, lookupStatic]);

  const enqueue = useCallback(
    (text: string) => {
      const target = normalizeLang(i18n.language);
      if (target === "en" || !text.trim()) return;
      if (lookupStatic(text, target)) return;
      const key = cacheKey("en", target, text);
      if (failed.current.has(key)) return;
      const cached = memory.current[key];
      if (cached && cached.trim() !== text.trim()) return;
      if (inflight.current.has(key)) return;
      queue.current.add(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 50);
    },
    [flush, i18n.language, lookupStatic]
  );

  const tContent = useCallback(
    (text: string) => {
      // version is read so consumers re-render after cache fills
      void version;
      if (!text?.trim() || lang === "en") return text;
      const staticHit = lookupStatic(text, lang);
      if (staticHit) return staticHit;
      const key = cacheKey("en", lang, text);
      const cached = memory.current[key];
      if (cached && cached.trim() !== text.trim()) return cached;
      enqueue(text);
      return text;
    },
    [enqueue, lang, lookupStatic, version]
  );

  const tMany = useCallback((texts: string[]) => texts.map((t) => tContent(t)), [tContent]);

  useEffect(() => {
    setVersion((v) => v + 1);
  }, [lang]);

  const value = useMemo(
    () => ({ lang, tContent, tMany, ready: true }),
    [lang, tContent, tMany]
  );

  return (
    <ContentTranslationContext.Provider value={value}>{children}</ContentTranslationContext.Provider>
  );
}

export function useContentTranslation() {
  const ctx = useContext(ContentTranslationContext);
  if (!ctx) {
    throw new Error("useContentTranslation must be used within ContentTranslationProvider");
  }
  return ctx;
}

/** Translate a single content string (ingredient name, recipe name, etc.) */
export function useTranslatedContent(text: string): string {
  const { tContent } = useContentTranslation();
  return tContent(text);
}
