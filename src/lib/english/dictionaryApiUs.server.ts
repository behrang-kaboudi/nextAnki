import "server-only";

type DictionaryPhonetic = { text?: unknown; audio?: unknown };
type DictionaryEntry = { phonetics?: unknown };

export class DictionaryApiRequestError extends Error {
  constructor(public readonly status: number) { super(`Dictionary API returned ${status}.`); }
}

function asHttpsUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.startsWith("//") ? `https:${value}` : value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** dictionaryapi.dev has no locale property; its audio filenames label US assets with `us`. */
function isUsAudio(url: URL): boolean {
  return /(?:--_|[-_])us(?:[_-]|\d|\.)/iu.test(url.pathname);
}

export async function getDictionaryApiUsPronunciation(word: string) {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) return { kind: "not_found" as const };
  if (!response.ok) throw new DictionaryApiRequestError(response.status);
  const entries = (await response.json()) as DictionaryEntry[];
  for (const entry of entries) {
    if (!Array.isArray(entry.phonetics)) continue;
    for (const phonetic of entry.phonetics as DictionaryPhonetic[]) {
      const text = typeof phonetic.text === "string" ? phonetic.text.trim() : "";
      const audioUrl = asHttpsUrl(phonetic.audio);
      if (text && audioUrl && isUsAudio(audioUrl)) return { kind: "us_pronunciation" as const, phonetic_us: text, audioUrl: audioUrl.toString() };
    }
  }
  return { kind: "no_us_pronunciation" as const };
}
