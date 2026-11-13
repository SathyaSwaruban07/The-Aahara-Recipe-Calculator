import https from "node:https";

const LANG_TL: Record<string, string> = {
  en: "en",
  ta: "ta",
  hi: "hi",
};

/** Google Translate TTS rejects very long queries; keep chunks short. */
const MAX_CHUNK = 160;

export function chunkForTts(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const parts: string[] = [];
  const sentences = cleaned.split(/(?<=[。.!?…])\s+/);

  let buf = "";
  const pushBuf = () => {
    if (buf.trim()) parts.push(buf.trim());
    buf = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > MAX_CHUNK) {
      pushBuf();
      for (let i = 0; i < sentence.length; i += MAX_CHUNK) {
        parts.push(sentence.slice(i, i + MAX_CHUNK).trim());
      }
      continue;
    }
    if ((buf + " " + sentence).trim().length > MAX_CHUNK) {
      pushBuf();
      buf = sentence;
    } else {
      buf = buf ? `${buf} ${sentence}` : sentence;
    }
  }
  pushBuf();
  return parts.filter(Boolean);
}

function httpsGetBuffer(url: string, headers: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers,
        // Many corp networks intercept TLS; Node must accept the proxy cert
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          httpsGetBuffer(res.headers.location, headers).then(resolve, reject);
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`TTS HTTP ${res.statusCode || 0}`));
            return;
          }
          resolve(body);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("TTS request timed out"));
    });
  });
}

async function fetchGoogleTts(text: string, tl: string, client: string): Promise<Buffer> {
  const url =
    `https://translate.google.com/translate_tts?ie=UTF-8` +
    `&client=${encodeURIComponent(client)}` +
    `&tl=${encodeURIComponent(tl)}` +
    `&q=${encodeURIComponent(text)}`;

  const buf = await httpsGetBuffer(url, {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9,ta;q=0.8,hi;q=0.7",
    Referer: "https://translate.google.com/",
  });

  if (buf.length < 64) {
    throw new Error(`TTS empty audio (client=${client})`);
  }
  // Google sometimes returns an HTML error page
  const head = buf.subarray(0, 16).toString("utf8");
  if (head.includes("<!") || head.includes("<html")) {
    throw new Error(`TTS returned HTML instead of audio (client=${client})`);
  }
  return buf;
}

export async function fetchTtsMp3(text: string, lang: "en" | "ta" | "hi"): Promise<Buffer> {
  const tl = LANG_TL[lang] || "en";
  const q = text.trim();
  if (!q) throw new Error("Empty TTS text");

  const errors: string[] = [];
  for (const client of ["gtx", "tw-ob"]) {
    try {
      return await fetchGoogleTts(q, tl, client);
    } catch (e) {
      errors.push(`${client}: ${(e as Error).message}`);
    }
  }

  throw new Error(`TTS providers failed: ${errors.join(" | ")}`);
}
