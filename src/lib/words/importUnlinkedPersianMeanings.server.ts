import "server-only";

import fs from "node:fs/promises";

import { buildPersianWordCanonicalTextAudioFilename } from "@/lib/audio/persianWordAudioNaming";
import { getPersianWordAudioAbsoluteDir, getPersianWordAudioAbsolutePath } from "@/lib/audio/persianWordAudioPaths.server";
import { getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { getLatestWordFieldAudioFile } from "@/lib/words/wordFieldVoice";
import { prisma } from "@/lib/prisma";
import { addPersianWord, PersianWordNormalizationConflictError } from "@/lib/tables/persianWord";

export type ImportUnlinkedPersianMeaningsResult = {
  scanned: number;
  created: number;
  variantsAdded: number;
  unchanged: number;
  audioCopied: number;
  skippedNoPersianText: number;
  skippedDuplicateNormalizedText: number;
  skippedIpaConflict: number;
  skippedExistingAudio: number;
  skippedNoSourceAudio: number;
  failed: number;
  skipped: Array<{ wordId: number; meaningFa: string; reason: string }>;
};

function emptyResult(): ImportUnlinkedPersianMeaningsResult {
  return {
    scanned: 0,
    created: 0,
    variantsAdded: 0,
    unchanged: 0,
    audioCopied: 0,
    skippedNoPersianText: 0,
    skippedDuplicateNormalizedText: 0,
    skippedIpaConflict: 0,
    skippedExistingAudio: 0,
    skippedNoSourceAudio: 0,
    failed: 0,
    skipped: [],
  };
}

async function hasUsablePersianWordAudio(filename: string | null): Promise<boolean> {
  if (!filename) return false;
  try {
    return (await fs.stat(getPersianWordAudioAbsolutePath(filename))).isFile();
  } catch {
    return false;
  }
}

export async function importUnlinkedPersianMeanings(): Promise<ImportUnlinkedPersianMeaningsResult> {
  const result = emptyResult();
  const rows = await prisma.word.findMany({
    where: { meaningId: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      anki_link_id: true,
      meaning_fa: true,
      meaning_fa_IPA: true,
      meaning_fa_IPA_normalized: true,
    },
  });

  await fs.mkdir(getPersianWordAudioAbsoluteDir(), { recursive: true });

  for (const row of rows) {
    result.scanned += 1;
    try {
      const added = await addPersianWord(row.meaning_fa, {
        meaningFaIpa: row.meaning_fa_IPA,
        meaningFaIpaNormalized: row.meaning_fa_IPA_normalized,
      });
      result[added.action === "created" ? "created" : added.action === "variant_added" ? "variantsAdded" : "unchanged"] += 1;

      const target = await prisma.persianWord.findUnique({
        where: { id: added.item.id },
        select: { audio_file_name: true },
      });
      if (await hasUsablePersianWordAudio(target?.audio_file_name ?? null)) {
        result.skippedExistingAudio += 1;
        continue;
      }

      const sourceAudio = getLatestWordFieldAudioFile({
        audioKey: row.anki_link_id,
        ankiLinkId: row.anki_link_id,
        field: "meaning_fa",
      });
      if (!sourceAudio || sourceAudio.size <= 0) {
        result.skippedNoSourceAudio += 1;
        continue;
      }

      const filename = buildPersianWordCanonicalTextAudioFilename({ persianWordId: added.item.id });
      await fs.copyFile(getWordFieldAudioAbsolutePath(sourceAudio.filename), getPersianWordAudioAbsolutePath(filename));
      await prisma.persianWord.update({ where: { id: added.item.id }, data: { audio_file_name: filename } });
      result.audioCopied += 1;
    } catch (error) {
      if (error instanceof PersianWordNormalizationConflictError) {
        result.skippedDuplicateNormalizedText += 1;
        result.skipped.push({ wordId: row.id, meaningFa: row.meaning_fa, reason: error.message });
      } else if (error instanceof Error && /Persian letter/.test(error.message)) {
        result.skippedNoPersianText += 1;
        result.skipped.push({ wordId: row.id, meaningFa: row.meaning_fa, reason: "meaning_fa does not contain a valid Persian word." });
      } else if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        result.skippedIpaConflict += 1;
        const conflictingIpa = row.meaning_fa_IPA.trim();
        const existing = conflictingIpa
          ? await prisma.persianWord.findFirst({
              where: { meaning_fa_IPA: conflictingIpa },
              select: { id: true, canonical_text: true },
            })
          : null;
        result.skipped.push({
          wordId: row.id,
          meaningFa: row.meaning_fa,
          reason: existing
            ? `IPA "${conflictingIpa}" is already used by PersianWord ${existing.id} (${existing.canonical_text}).`
            : "A unique database value is already in use.",
        });
      } else {
        result.failed += 1;
        result.skipped.push({
          wordId: row.id,
          meaningFa: row.meaning_fa,
          reason: error instanceof Error ? error.message : "Unknown error while adding PersianWord.",
        });
      }
    }
  }

  return result;
}
