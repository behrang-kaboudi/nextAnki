import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { buildEnglishWordAudioFilename } from "@/lib/audio/englishWordAudioNaming";
import { getEnglishWordAudioAbsoluteDir, getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { getLatestWordFieldAudioFile } from "@/lib/words/wordFieldVoice";
import { getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";

export const runtime = "nodejs";
const BATCH_SIZE = 100;

type Detail = { id: number; base_form: string; outcome: string; detail: string };

export async function POST(request: Request) {
  const report = { checked: 0, phoneticCopied: 0, audioCopied: 0, noMatchingWord: 0, noWordPhonetic: 0, noWordAudio: 0, uniqueConflict: 0, failed: 0, details: [] as Detail[] };
  try {
    const body = (await request.json().catch(() => null)) as { afterId?: unknown } | null;
    const afterId = typeof body?.afterId === "number" && Number.isSafeInteger(body.afterId) && body.afterId > 0 ? body.afterId : 0;
    const targets = await prisma.englishWord.findMany({
      where: { id: { gt: afterId }, OR: [{ phonetic_us: null }, { phonetic_us: "" }] },
      orderBy: { id: "asc" }, take: BATCH_SIZE,
      select: { id: true, base_form: true, audio_file_name: true },
    });
    const words = await prisma.word.findMany({
      where: { base_form: { not: "" } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, anki_link_id: true, base_form: true, phonetic_us: true },
    });
    const wordsByNormalizedText = new Map<string, typeof words>();
    for (const word of words) {
      const key = normalizeEnglishWordText(word.base_form);
      if (!key) continue;
      wordsByNormalizedText.set(key, [...(wordsByNormalizedText.get(key) ?? []), word]);
    }
    await mkdir(getEnglishWordAudioAbsoluteDir(), { recursive: true });

    for (const target of targets) {
      report.checked += 1;
      const candidates = wordsByNormalizedText.get(target.base_form) ?? [];
      if (!candidates.length) {
        report.noMatchingWord += 1;
        if (report.details.length < 30) report.details.push({ id: target.id, base_form: target.base_form, outcome: "no_matching_word", detail: "No matching Word was found." });
        continue;
      }
      const source = candidates.find((candidate) => candidate.phonetic_us?.trim());
      if (!source?.phonetic_us?.trim()) {
        report.noWordPhonetic += 1;
        if (report.details.length < 30) report.details.push({ id: target.id, base_form: target.base_form, outcome: "no_word_phonetic", detail: "Matching Word records have no phonetic_us." });
        continue;
      }
      const sourcePhonetic = source.phonetic_us.trim();
      const normalizedPhonetic = normalizeIpaForDb(sourcePhonetic, 2000) || null;
      let copiedFilename: string | null = null;
      try {
        const latestAudio = getLatestWordFieldAudioFile({ ankiLinkId: source.anki_link_id, field: "base_form" });
        if (latestAudio) {
          copiedFilename = buildEnglishWordAudioFilename({ englishWordId: target.id });
          await copyFile(getWordFieldAudioAbsolutePath(latestAudio.filename), getEnglishWordAudioAbsolutePath(copiedFilename));
        } else {
          report.noWordAudio += 1;
        }
        await prisma.englishWord.update({
          where: { id: target.id },
          data: { phonetic_us: sourcePhonetic, phonetic_us_normalized: normalizedPhonetic, ...(copiedFilename ? { audio_file_name: copiedFilename } : {}) },
        });
        report.phoneticCopied += 1;
        if (copiedFilename) {
          report.audioCopied += 1;
          if (target.audio_file_name && target.audio_file_name !== copiedFilename && path.basename(target.audio_file_name) === target.audio_file_name) await rm(getEnglishWordAudioAbsolutePath(target.audio_file_name), { force: true });
        }
      } catch (error) {
        if (copiedFilename) await rm(getEnglishWordAudioAbsolutePath(copiedFilename), { force: true });
        const isUnique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (isUnique) report.uniqueConflict += 1; else report.failed += 1;
        if (report.details.length < 30) {
          if (isUnique && normalizedPhonetic) {
            const existing = await prisma.englishWord.findFirst({ where: { phonetic_us_normalized: normalizedPhonetic }, select: { id: true, base_form: true, phonetic_us: true, phonetic_us_normalized: true } });
            report.details.push({ id: target.id, base_form: target.base_form, outcome: "unique_conflict", detail: `Source Word #${source.id} (${source.base_form}) → phonetic_us: ${sourcePhonetic}; normalized: ${normalizedPhonetic}. Already used by EnglishWord #${existing?.id ?? "unknown"} (${existing?.base_form ?? "unknown"}) → phonetic_us: ${existing?.phonetic_us ?? "unknown"}; normalized: ${existing?.phonetic_us_normalized ?? "unknown"}.` });
          } else {
            report.details.push({ id: target.id, base_form: target.base_form, outcome: "failed", detail: error instanceof Error ? error.message : String(error) });
          }
        }
      }
    }
    return NextResponse.json({ ok: true, report, nextAfterId: targets.at(-1)?.id ?? afterId, remainingInNextRun: targets.length === BATCH_SIZE });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not copy fields from Word." }, { status: 500 });
  }
}
