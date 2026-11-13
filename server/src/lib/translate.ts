const LIBRE_URL = process.env.LIBRETRANSLATE_URL || "https://libretranslate.com";
const FETCH_TIMEOUT_MS = 1800;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function translateViaLibre(
  text: string,
  target: string,
  source: string,
  baseUrl: string
): Promise<string> {
  const body: Record<string, string> = {
    q: text,
    source,
    target,
    format: "text",
  };

  if (process.env.LIBRETRANSLATE_API_KEY) {
    body.api_key = process.env.LIBRETRANSLATE_API_KEY;
  }

  const res = await withTimeout(
    fetch(`${baseUrl}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    FETCH_TIMEOUT_MS,
    baseUrl
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LibreTranslate failed (${res.status}): ${errText || res.statusText}`);
  }

  const data = (await res.json()) as { translatedText?: string };
  const out = data.translatedText?.trim();
  if (!out) throw new Error("LibreTranslate returned empty");
  return out;
}

async function translateViaMyMemory(
  text: string,
  target: string,
  source: string
): Promise<string> {
  const url =
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
    `&langpair=${encodeURIComponent(source)}|${encodeURIComponent(target)}`;

  const res = await withTimeout(fetch(url), FETCH_TIMEOUT_MS, "mymemory");
  if (!res.ok) {
    throw new Error(`MyMemory failed (${res.status})`);
  }

  const data = (await res.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number;
  };

  if (data.responseStatus && data.responseStatus !== 200) {
    throw new Error(`MyMemory status ${data.responseStatus}`);
  }

  const out = data.responseData?.translatedText?.trim();
  if (!out) throw new Error("MyMemory returned empty");
  return out;
}

export async function translateText(
  text: string,
  target: string,
  source = "en"
): Promise<string> {
  if (!text.trim() || target === source) return text;

  // Race primary Libre instance + MyMemory — first success wins (fail fast on dead mirrors)
  const candidates = [
    translateViaLibre(text, target, source, LIBRE_URL),
    translateViaMyMemory(text, target, source),
  ];

  try {
    return await Promise.any(candidates);
  } catch {
    // All failed quickly — return source so the UI isn't blocked
    return text;
  }
}

export async function translateBatch(
  texts: string[],
  target: string,
  source = "en"
): Promise<string[]> {
  // Small parallelism — much faster than serial 4-mirror timeouts per string
  const concurrency = 4;
  const results = new Array<string>(texts.length);
  let next = 0;

  async function worker() {
    while (next < texts.length) {
      const i = next++;
      try {
        results[i] = await translateText(texts[i], target, source);
      } catch {
        results[i] = texts[i];
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, texts.length) }, () => worker())
  );
  return results;
}
