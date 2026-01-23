import "server-only";

import fs from "node:fs";
import path from "node:path";

import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";
import {
  buildHintSentenceAudioFilename,
  type HintSentenceAudioFilenameOptions,
} from "@/lib/audio/hintSentenceAudioNaming";

export type HintSentenceVoiceProvider = "azure" | "openai" | "polly";

export type PublicAudioFileInfo = { absPath: string; exists: boolean; size: number };

export function getPublicAudioFileInfo(filename: string): PublicAudioFileInfo {
  const absPath = path.join(process.cwd(), "public", "audio", filename);
  try {
    const st = fs.statSync(absPath);
    return { absPath, exists: true, size: st.size };
  } catch {
    return { absPath, exists: false, size: 0 };
  }
}

export type HintSentenceAudioFileMatch = { filename: string; timestampMs: number; size: number };

export function listHintSentenceAudioFilesForId(id: number): HintSentenceAudioFileMatch[] {
  const dir = path.join(process.cwd(), "public", "audio");
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const re = new RegExp(`^${id}_hint_(?<ts>\\d{8,})\\.mp3$`);
  const matches: HintSentenceAudioFileMatch[] = [];

  for (const filename of entries) {
    const m = re.exec(filename);
    const ts = Number(m?.groups?.ts);
    if (!Number.isFinite(ts)) continue;
    const info = getPublicAudioFileInfo(filename);
    if (!info.exists) continue;
    matches.push({ filename, timestampMs: Math.trunc(ts), size: info.size });
  }

  matches.sort((a, b) => b.timestampMs - a.timestampMs);
  return matches;
}

export function getLatestHintSentenceAudioFileForId(id: number): HintSentenceAudioFileMatch | null {
  return listHintSentenceAudioFilesForId(id)[0] ?? null;
}

export type EnsureHintSentenceVoiceResult =
  | { action: "skipped_no_text" }
  | { action: "skipped_exists"; filename: string }
  | { action: "generated"; filename: string }
  | { action: "regenerated_zero_byte"; filename: string };

export type EnsureHintSentenceVoiceOptions = {
  id: number;
  hintSentence: string | null | undefined;
  provider?: HintSentenceVoiceProvider;
  filenameFor?: (opts: HintSentenceAudioFilenameOptions) => string;
};

export async function ensureHintSentenceVoice({
  id,
  hintSentence,
  provider = "azure",
  filenameFor = buildHintSentenceAudioFilename,
}: EnsureHintSentenceVoiceOptions): Promise<EnsureHintSentenceVoiceResult> {
  const text = typeof hintSentence === "string" ? hintSentence.trim() : "";
  if (!text) return { action: "skipped_no_text" };

  const latest = getLatestHintSentenceAudioFileForId(id);
  if (latest) {
    if (latest.size === 0) {
      await generateSpeechFromMixedText(text, latest.filename, provider);
      return { action: "regenerated_zero_byte", filename: latest.filename };
    }
    return { action: "skipped_exists", filename: latest.filename };
  }

  const filename = filenameFor({ id });
  await generateSpeechFromMixedText(text, filename, provider);
  return { action: "generated", filename };
}
