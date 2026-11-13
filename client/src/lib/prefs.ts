const ZOOM_KEY = "recipe-proportions-zoom";
const LANG_KEY = "recipe-proportions-lang";

export const LANGS = ["en", "ta", "hi"] as const;
export type PrefLang = (typeof LANGS)[number];

export function readZoomPercent(fallback: number): number {
  try {
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw == null) return fallback;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeZoomPercent(percent: number): void {
  try {
    localStorage.setItem(ZOOM_KEY, String(Math.round(percent)));
  } catch {
    /* ignore */
  }
}

export function readLang(fallback: PrefLang = "en"): PrefLang {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw && (LANGS as readonly string[]).includes(raw)) return raw as PrefLang;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeLang(lang: string): void {
  const normalized = LANGS.find((l) => lang === l || lang.startsWith(l)) ?? "en";
  try {
    localStorage.setItem(LANG_KEY, normalized);
  } catch {
    /* ignore */
  }
}
