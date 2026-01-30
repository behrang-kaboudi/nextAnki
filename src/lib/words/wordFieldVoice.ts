import "server-only";

import fs from "node:fs";

import {
  type WordAudioFieldKey,
  WORD_AUDIO_FILENAME_SEPARATOR,
  WORD_AUDIO_PUBLIC_URL_PREFIX,
  sanitizeWordAudioFilenamePart,
} from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldAudioAbsoluteDir, getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";

export type WordFieldAudioFileMatch = { filename: string; timestampMs: number; size: number };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listWordFieldAudioFiles({
  ankiLinkId,
  field,
}: {
  ankiLinkId: string;
  field: WordAudioFieldKey;
}): WordFieldAudioFileMatch[] {
  const dir = getWordFieldAudioAbsoluteDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const id = sanitizeWordAudioFilenamePart(ankiLinkId);
  const sep = escapeRegExp(WORD_AUDIO_FILENAME_SEPARATOR);
  const reNew = new RegExp(`^${escapeRegExp(id)}${sep}${escapeRegExp(field)}${sep}(?<ts>\\d{8,})\\.mp3$`);
  const reLegacy = new RegExp(`^${escapeRegExp(id)}_${escapeRegExp(field)}_(?<ts>\\d{8,})\\.mp3$`);

  const matches: WordFieldAudioFileMatch[] = [];

  for (const filename of entries) {
    const m = reNew.exec(filename) ?? reLegacy.exec(filename);
    const ts = Number(m?.groups?.ts);
    if (!Number.isFinite(ts)) continue;
    let size = 0;
    try {
      size = fs.statSync(getWordFieldAudioAbsolutePath(filename)).size;
    } catch {
      continue;
    }
    matches.push({ filename, timestampMs: Math.trunc(ts), size });
  }

  matches.sort((a, b) => b.timestampMs - a.timestampMs);
  return matches;
}

export function getLatestWordFieldAudioFile({
  ankiLinkId,
  field,
}: {
  ankiLinkId: string;
  field: WordAudioFieldKey;
}): WordFieldAudioFileMatch | null {
  return listWordFieldAudioFiles({ ankiLinkId, field })[0] ?? null;
}

export function getWordFieldAudioPublicPathFromFilename(filename: string): string {
  return `${WORD_AUDIO_PUBLIC_URL_PREFIX}/${encodeURIComponent(filename)}`;
}

export function getWordFieldAudioFileInfo(filename: string): { absPath: string; exists: boolean; size: number } {
  const absPath = getWordFieldAudioAbsolutePath(filename);
  try {
    const st = fs.statSync(absPath);
    return { absPath, exists: true, size: st.size };
  } catch {
    return { absPath, exists: false, size: 0 };
  }
}
