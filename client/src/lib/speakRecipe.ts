export type SpeakLang = "en" | "ta" | "hi";

export type SpeakResult =
  | { ok: true; mode: "local" | "server" }
  | { ok: false; reason: "unsupported" | "empty" | "no-voice" | "failed" };

const API_BASE = import.meta.env.VITE_API_URL || "/api";

let remoteAudio: HTMLAudioElement | null = null;
let remoteStopped = false;
let localSpeaking = false;
/** Only the button that started playback should show the speaking / wave state. */
let activeSpeakerId: string | null = null;
let sessionGeneration = 0;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

export function speakLocale(lang: SpeakLang): string {
  if (lang === "ta") return "ta-IN";
  if (lang === "hi") return "hi-IN";
  return "en-IN";
}

function normalizeLangTag(value: string): string {
  return value.toLowerCase().replace(/_/g, "-");
}

function pickVoice(
  lang: SpeakLang,
  voices = speechSupported() ? window.speechSynthesis.getVoices() : []
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;

  const locale = normalizeLangTag(speakLocale(lang));
  const prefix = lang === "en" ? "en" : lang;
  const nameHints =
    lang === "ta"
      ? /tamil|தமிழ்|valluvar|krishna|radhae/i
      : lang === "hi"
        ? /hindi|हिन्दी|हिंदी|hemant|kalpana/i
        : /english|ravi|heera|zira|david|google/i;

  const byLang = voices.filter((v) => {
    const tag = normalizeLangTag(v.lang || "");
    return tag === locale || tag.startsWith(`${prefix}-`) || tag === prefix;
  });

  const byName = voices.filter((v) => nameHints.test(v.name || ""));

  return (
    byLang.find((v) => nameHints.test(v.name || "")) ||
    byLang[0] ||
    byName[0] ||
    (lang === "en" ? voices.find((v) => normalizeLangTag(v.lang).startsWith("en")) || null : null)
  );
}

export function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(done, 500);
  });
}

function stopRemoteAudio(): void {
  if (remoteAudio) {
    try {
      remoteAudio.onended = null;
      remoteAudio.onerror = null;
      remoteAudio.pause();
      remoteAudio.removeAttribute("src");
      remoteAudio.load();
    } catch {
      /* ignore */
    }
    remoteAudio = null;
  }
}

export function stopSpeaking(speakerId?: string): void {
  if (speakerId && activeSpeakerId && speakerId !== activeSpeakerId) return;

  remoteStopped = true;
  sessionGeneration += 1;
  if (speechSupported()) {
    window.speechSynthesis.cancel();
  }
  localSpeaking = false;
  activeSpeakerId = null;
  stopRemoteAudio();
}

export function isSpeaking(): boolean {
  if (remoteAudio && !remoteAudio.paused && !remoteAudio.ended) return true;
  return speechSupported() && (window.speechSynthesis.speaking || localSpeaking);
}

/** True for the whole readout session (including pauses between ingredients). */
export function isSpeakerActive(speakerId: string): boolean {
  return activeSpeakerId === speakerId;
}

export function getActiveSpeakerId(): string | null {
  return activeSpeakerId;
}

function chunkText(text: string, max = 160): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= max) return [cleaned];

  const out: string[] = [];
  const sentences = cleaned.split(/(?<=[。.!?…])\s+/);
  let buf = "";
  for (const sentence of sentences) {
    if (sentence.length > max) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      for (let i = 0; i < sentence.length; i += max) out.push(sentence.slice(i, i + max));
      continue;
    }
    const next = buf ? `${buf} ${sentence}` : sentence;
    if (next.length > max) {
      out.push(buf);
      buf = sentence;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function playUrl(url: string, generation: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (remoteStopped || generation !== sessionGeneration) {
      resolve();
      return;
    }
    stopRemoteAudio();
    const audio = new Audio(url);
    remoteAudio = audio;
    audio.onended = () => {
      if (remoteAudio === audio) remoteAudio = null;
      resolve();
    };
    audio.onerror = () => {
      if (remoteAudio === audio) remoteAudio = null;
      reject(new Error("Audio playback failed"));
    };
    void audio.play().catch((err) => {
      if (remoteAudio === audio) remoteAudio = null;
      reject(err);
    });
  });
}

const SEGMENT_PAUSE_MS = 1100;
/** Chrome often kills the next utterance if speak() happens immediately after cancel(). */
const POST_CANCEL_DELAY_MS = 280;
/** Broken OS voices often fire onend almost instantly with no audible speech. */
const MIN_LINE_MS = 120;

function delay(ms: number, generation: number): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms);
  }).then(() => {
    if (remoteStopped || generation !== sessionGeneration) return;
  });
}

async function speakViaServerSegments(
  segments: string[],
  lang: SpeakLang,
  generation: number
): Promise<SpeakResult> {
  const lines = segments.map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, reason: "empty" };

  try {
    for (let i = 0; i < lines.length; i++) {
      if (remoteStopped || generation !== sessionGeneration) return { ok: true, mode: "server" };
      const chunks = chunkText(lines[i]);
      for (const chunk of chunks) {
        if (remoteStopped || generation !== sessionGeneration) return { ok: true, mode: "server" };
        const url =
          `${API_BASE}/recipes/tts?lang=${encodeURIComponent(lang)}` +
          `&text=${encodeURIComponent(chunk)}`;
        await playUrl(url, generation);
      }
      if (i < lines.length - 1 && !remoteStopped && generation === sessionGeneration) {
        await delay(SEGMENT_PAUSE_MS, generation);
      }
    }
    return { ok: true, mode: "server" };
  } catch {
    stopRemoteAudio();
    return { ok: false, reason: "failed" };
  }
}

function speakViaLocalLine(
  text: string,
  lang: SpeakLang,
  voice: SpeechSynthesisVoice,
  generation: number
): Promise<SpeakResult> {
  return new Promise((resolve) => {
    if (remoteStopped || generation !== sessionGeneration) {
      resolve({ ok: true, mode: "local" });
      return;
    }

    const startedAt = Date.now();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = voice.lang || speakLocale(lang);
    utterance.voice = voice;
    utterance.rate = lang === "ta" || lang === "hi" ? 0.78 : 0.85;

    const keepAlive = window.setInterval(() => {
      if (!window.speechSynthesis.speaking || generation !== sessionGeneration) {
        window.clearInterval(keepAlive);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 8000);

    const finish = (result: SpeakResult) => {
      window.clearInterval(keepAlive);
      resolve(result);
    };

    utterance.onend = () => {
      // Instant end = unusable voice (common for “fake” ta/hi voices on Windows)
      if (Date.now() - startedAt < MIN_LINE_MS && !remoteStopped) {
        finish({ ok: false, reason: "failed" });
        return;
      }
      finish({ ok: true, mode: "local" });
    };
    utterance.onerror = (event) => {
      const errType = (event as SpeechSynthesisErrorEvent).error;
      if (remoteStopped || errType === "interrupted" || errType === "canceled") {
        finish({ ok: true, mode: "local" });
        return;
      }
      finish({ ok: false, reason: "failed" });
    };

    try {
      localSpeaking = true;
      window.speechSynthesis.speak(utterance);
    } catch {
      finish({ ok: false, reason: "failed" });
    }
  });
}

async function speakViaLocalSegments(
  segments: string[],
  lang: SpeakLang,
  voice: SpeechSynthesisVoice,
  generation: number
): Promise<SpeakResult> {
  const lines = segments.map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, reason: "empty" };

  localSpeaking = true;
  try {
    // Prove the voice can actually produce audio before committing to the full recipe
    const probe = await speakViaLocalLine(lines[0], lang, voice, generation);
    if (!probe.ok) return probe;
    if (remoteStopped || generation !== sessionGeneration) return { ok: true, mode: "local" };

    for (let i = 1; i < lines.length; i++) {
      if (remoteStopped || generation !== sessionGeneration) return { ok: true, mode: "local" };
      await delay(SEGMENT_PAUSE_MS, generation);
      if (remoteStopped || generation !== sessionGeneration) return { ok: true, mode: "local" };

      const result = await speakViaLocalLine(lines[i], lang, voice, generation);
      if (!result.ok) return result;
    }
    return { ok: true, mode: "local" };
  } finally {
    localSpeaking = false;
  }
}

/**
 * Speak recipe lines one-by-one with a short pause between each.
 * Tamil/Hindi prefer server audio (device voices are often silent stubs).
 */
export async function speakText(
  textOrSegments: string | string[],
  lang: SpeakLang,
  speakerId = "default"
): Promise<SpeakResult> {
  const segments = (Array.isArray(textOrSegments) ? textOrSegments : [textOrSegments])
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return { ok: false, reason: "empty" };

  stopSpeaking();
  await delay(POST_CANCEL_DELAY_MS, sessionGeneration);

  remoteStopped = false;
  sessionGeneration += 1;
  const generation = sessionGeneration;
  activeSpeakerId = speakerId;

  const clearIfStillMine = () => {
    if (activeSpeakerId === speakerId && generation === sessionGeneration) {
      activeSpeakerId = null;
    }
  };

  try {
    // Tamil / Hindi: use online audio first — Windows “voices” often end instantly with no sound
    if (lang === "ta" || lang === "hi") {
      const remote = await speakViaServerSegments(segments, lang, generation);
      if (remote.ok) return remote;

      const voices = await ensureVoicesLoaded();
      if (generation !== sessionGeneration || activeSpeakerId !== speakerId) {
        return { ok: true, mode: "server" };
      }
      const localVoice = pickVoice(lang, voices);
      if (localVoice) {
        const localResult = await speakViaLocalSegments(segments, lang, localVoice, generation);
        if (localResult.ok) return localResult;
      }
      return { ok: false, reason: "no-voice" };
    }

    // English: local voice first, then server fallback
    if (!speechSupported()) {
      const remote = await speakViaServerSegments(segments, lang, generation);
      return remote.ok ? remote : { ok: false, reason: "unsupported" };
    }

    const voices = await ensureVoicesLoaded();
    if (generation !== sessionGeneration || activeSpeakerId !== speakerId) {
      return { ok: true, mode: "local" };
    }

    const localVoice = pickVoice("en", voices);
    if (localVoice) {
      const localResult = await speakViaLocalSegments(segments, lang, localVoice, generation);
      if (localResult.ok) return localResult;
      if (generation !== sessionGeneration || activeSpeakerId !== speakerId) {
        return { ok: true, mode: "local" };
      }
    }

    const remote = await speakViaServerSegments(segments, lang, generation);
    return remote.ok ? remote : { ok: false, reason: "failed" };
  } finally {
    clearIfStillMine();
  }
}

export interface SpeakableIngredient {
  name: string;
  amountLabel: string;
  soakLabel?: string;
}

export function buildRecipeSpeechSegments(options: {
  recipeName: string;
  category?: string;
  servingsLabel?: string;
  ingredients: SpeakableIngredient[];
  notes?: string;
  introIngredients: string;
}): string[] {
  const parts: string[] = [];
  parts.push(options.recipeName);
  if (options.category) parts.push(options.category);
  if (options.servingsLabel) parts.push(options.servingsLabel);
  parts.push(options.introIngredients);

  for (const ing of options.ingredients) {
    let line = `${ing.name}. ${ing.amountLabel}`;
    if (ing.soakLabel) line += `. ${ing.soakLabel}`;
    parts.push(line);
  }

  if (options.notes?.trim()) parts.push(options.notes.trim());
  return parts.filter((p) => p.trim());
}

export function buildRecipeSpeechScript(options: {
  recipeName: string;
  category?: string;
  servingsLabel?: string;
  ingredients: SpeakableIngredient[];
  notes?: string;
  introIngredients: string;
}): string {
  return buildRecipeSpeechSegments(options).join(". ") + ".";
}
