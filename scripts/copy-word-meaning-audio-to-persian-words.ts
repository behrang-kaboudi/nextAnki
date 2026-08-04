import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import {
  PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE,
  buildPersianWordCanonicalTextAudioFilename,
} from "../src/lib/audio/persianWordAudioNaming.ts";
import {
  WORD_AUDIO_FILENAME_SEPARATOR,
  sanitizeWordAudioFilenamePart,
} from "../src/lib/audio/wordFieldAudioNaming.ts";

dotenv.config();

const prisma = new PrismaClient();
const sourceDir = path.join(process.cwd(), "public", "audio", "words");
const destinationDir = path.join(process.cwd(), "public", PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE);
const force = process.env.FORCE === "1";

type AudioMatch = { filename: string; timestampMs: number };

type Stats = {
  scanned: number;
  copied: number;
  skippedExisting: number;
  skippedNoIpa: number;
  skippedNoSourceWord: number;
  skippedNoSourceAudio: number;
  failed: number;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function indexLatestMeaningFaAudio(): Promise<Map<string, AudioMatch>> {
  const latestByKey = new Map<string, AudioMatch>();
  const separator = escapeRegExp(WORD_AUDIO_FILENAME_SEPARATOR);
  const newFormat = new RegExp(`^(?<key>.+?)${separator}meaning_fa${separator}(?<ts>\\d{8,})\\.mp3$`);
  const legacyFormat = new RegExp(`^(?<key>.+)_meaning_fa_(?<ts>\\d{8,})\\.mp3$`);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(sourceDir);
  } catch {
    return latestByKey;
  }

  for (const filename of entries) {
    const match = newFormat.exec(filename) ?? legacyFormat.exec(filename);
    const key = match?.groups?.key;
    const timestampMs = Number(match?.groups?.ts);
    if (!key || !Number.isFinite(timestampMs)) continue;

    try {
      const stat = await fs.stat(path.join(sourceDir, filename));
      if (!stat.isFile() || stat.size <= 0) continue;
    } catch {
      continue;
    }

    const previous = latestByKey.get(key);
    if (!previous || timestampMs > previous.timestampMs) {
      latestByKey.set(key, { filename, timestampMs });
    }
  }

  return latestByKey;
}

async function main() {
  const stats: Stats = {
    scanned: 0,
    copied: 0,
    skippedExisting: 0,
    skippedNoIpa: 0,
    skippedNoSourceWord: 0,
    skippedNoSourceAudio: 0,
    failed: 0,
  };

  await fs.mkdir(destinationDir, { recursive: true });
  const latestMeaningFaAudioByKey = await indexLatestMeaningFaAudio();

  const rows = await prisma.persianWord.findMany({
    orderBy: { id: "asc" },
    select: { id: true, meaning_fa_IPA: true, audio_file_name: true },
  });

  for (const row of rows) {
    stats.scanned += 1;
    const ipa = row.meaning_fa_IPA?.trim();
    if (!ipa) {
      stats.skippedNoIpa += 1;
      continue;
    }

    if (row.audio_file_name && !force) {
      try {
        const stat = await fs.stat(path.join(destinationDir, row.audio_file_name));
        if (stat.isFile() && stat.size > 0) {
          stats.skippedExisting += 1;
          continue;
        }
      } catch {
        // The database points to a missing file; recover it from the Word audio below.
      }
    }

    try {
      const sourceWord = await prisma.word.findFirst({
        where: { meaning_fa_IPA: ipa },
        orderBy: { id: "asc" },
        select: { anki_link_id: true },
      });
      if (!sourceWord) {
        stats.skippedNoSourceWord += 1;
        continue;
      }

      const sourceAudio = latestMeaningFaAudioByKey.get(
        sanitizeWordAudioFilenamePart(sourceWord.anki_link_id)
      );
      if (!sourceAudio) {
        stats.skippedNoSourceAudio += 1;
        continue;
      }

      const filename = buildPersianWordCanonicalTextAudioFilename({ persianWordId: row.id });
      await fs.copyFile(path.join(sourceDir, sourceAudio.filename), path.join(destinationDir, filename));
      await prisma.persianWord.update({ where: { id: row.id }, data: { audio_file_name: filename } });
      stats.copied += 1;
    } catch (error) {
      stats.failed += 1;
      console.error(`PersianWord ${row.id}:`, error);
    }
  }

  console.log(JSON.stringify({ force, ...stats }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
