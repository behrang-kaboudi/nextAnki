import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  WORD_AUDIO_FIELDS,
  WORD_AUDIO_FILENAME_SEPARATOR,
  type WordAudioFieldKey,
} from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldAudioAbsoluteDir, getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { getWordFieldAudioPublicPathFromFilename } from "@/lib/words/wordFieldVoice";

export type WordFieldVoiceFileInfo = {
  filename: string;
  timestampMs: number;
  size: number;
  publicPath: string;
};

export type WordFieldVoiceDuplicateGroup = {
  ankiLinkIdPart: string;
  field: WordAudioFieldKey;
  keep: WordFieldVoiceFileInfo;
  duplicates: WordFieldVoiceFileInfo[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortNewestFirst(a: WordFieldVoiceFileInfo, b: WordFieldVoiceFileInfo) {
  if (b.timestampMs !== a.timestampMs) return b.timestampMs - a.timestampMs;
  if (b.size !== a.size) return b.size - a.size;
  return a.filename.localeCompare(b.filename);
}

export function listWordFieldVoiceDuplicateGroups(): WordFieldVoiceDuplicateGroup[] {
  const dir = getWordFieldAudioAbsoluteDir();
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const fieldsAlternation = WORD_AUDIO_FIELDS.map(escapeRegExp).join("|");
  const sep = escapeRegExp(WORD_AUDIO_FILENAME_SEPARATOR);
  const reNew = new RegExp(`^(?<anki>.+?)${sep}(?<field>${fieldsAlternation})${sep}(?<ts>\\d{8,})\\.mp3$`);
  const reLegacy = new RegExp(`^(?<anki>.+)_(?<field>${fieldsAlternation})_(?<ts>\\d{8,})\\.mp3$`);

  const grouped = new Map<string, { anki: string; field: WordAudioFieldKey; files: WordFieldVoiceFileInfo[] }>();

  for (const filename of entries) {
    if (!filename.endsWith(".mp3")) continue;
    if (filename.includes(path.sep) || filename.includes("/") || filename.includes("\\")) continue;

    const m = reNew.exec(filename) ?? reLegacy.exec(filename);
    const anki = typeof m?.groups?.anki === "string" ? m.groups.anki : null;
    const field = typeof m?.groups?.field === "string" ? (m.groups.field as WordAudioFieldKey) : null;
    const ts = Number(m?.groups?.ts);
    if (!anki || !field || !WORD_AUDIO_FIELDS.includes(field) || !Number.isFinite(ts)) continue;

    let size = 0;
    try {
      size = fs.statSync(getWordFieldAudioAbsolutePath(filename)).size;
    } catch {
      continue;
    }

    const info: WordFieldVoiceFileInfo = {
      filename,
      timestampMs: Math.trunc(ts),
      size,
      publicPath: getWordFieldAudioPublicPathFromFilename(filename),
    };

    const key = `${anki}::${field}`;
    const g = grouped.get(key);
    if (g) g.files.push(info);
    else grouped.set(key, { anki, field, files: [info] });
  }

  const groups: WordFieldVoiceDuplicateGroup[] = [];
  for (const { anki, field, files } of grouped.values()) {
    if (files.length <= 1) continue;
    files.sort(sortNewestFirst);
    groups.push({
      ankiLinkIdPart: anki,
      field,
      keep: files[0],
      duplicates: files.slice(1),
    });
  }

  groups.sort((a, b) => b.duplicates.length - a.duplicates.length || a.ankiLinkIdPart.localeCompare(b.ankiLinkIdPart));
  return groups;
}

export async function deleteWordFieldVoiceDuplicates(): Promise<{
  deleted: number;
  failed: number;
  deletedBytes: number;
}> {
  const dir = getWordFieldAudioAbsoluteDir();
  const dirResolved = path.resolve(dir);

  const groups = listWordFieldVoiceDuplicateGroups();
  let deleted = 0;
  let failed = 0;
  let deletedBytes = 0;

  for (const g of groups) {
    for (const f of g.duplicates) {
      const abs = getWordFieldAudioAbsolutePath(f.filename);
      const absResolved = path.resolve(abs);
      if (!absResolved.startsWith(dirResolved + path.sep)) {
        failed += 1;
        continue;
      }
      try {
        await fs.promises.unlink(absResolved);
        deleted += 1;
        deletedBytes += f.size;
      } catch {
        failed += 1;
      }
    }
  }

  return { deleted, failed, deletedBytes };
}

