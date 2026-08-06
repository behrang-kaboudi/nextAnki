import { mkdir, writeFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { buildEnglishWordAudioFilename } from "@/lib/audio/englishWordAudioNaming";
import { getEnglishWordAudioAbsoluteDir, getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { DictionaryApiRequestError, getDictionaryApiUsPronunciation } from "@/lib/english/dictionaryApiUs.server";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { touchWordsByEnglishId } from "@/lib/words/wordRepo";

export const runtime = "nodejs";
const BATCH_SIZE = 100;

export async function POST(request: Request) {
  const report = { checked: 0, foundUsPronunciation: 0, updatedPhonetic: 0, downloadedAudio: 0, notFound: 0, noUsPronunciation: 0, rateLimited: 0, failed: 0, details: [] as Array<{ id: number; base_form: string; outcome: string; detail: string }> };
  try {
    const body = (await request.json().catch(() => null)) as { afterId?: unknown } | null;
    const afterId = typeof body?.afterId === "number" && Number.isSafeInteger(body.afterId) && body.afterId > 0 ? body.afterId : 0;
    const rows = await prisma.englishWord.findMany({
      where: { id: { gt: afterId }, OR: [{ phonetic_us: null }, { phonetic_us: "" }, { audio_file_name: null }, { audio_file_name: "" }] },
      orderBy: { id: "asc" }, take: BATCH_SIZE,
      select: { id: true, base_form: true, phonetic_us: true, audio_file_name: true },
    });
    await mkdir(getEnglishWordAudioAbsoluteDir(), { recursive: true });
    for (const row of rows) {
      report.checked += 1;
      try {
        const pronunciation = await getDictionaryApiUsPronunciation(row.base_form);
        if (pronunciation.kind === "not_found") { report.notFound += 1; if (report.details.length < 30) report.details.push({ id: row.id, base_form: row.base_form, outcome: "not_found", detail: "Dictionary API returned 404." }); continue; }
        if (pronunciation.kind === "no_us_pronunciation") { report.noUsPronunciation += 1; if (report.details.length < 30) report.details.push({ id: row.id, base_form: row.base_form, outcome: "no_us_pronunciation", detail: "No paired US IPA and audio were returned." }); continue; }
        report.foundUsPronunciation += 1;
        let filename: string | null = null;
        if (!row.audio_file_name) {
          const audioResponse = await fetch(pronunciation.audioUrl, { signal: AbortSignal.timeout(20_000) });
          if (!audioResponse.ok) throw new Error(`Audio download returned ${audioResponse.status}.`);
          const bytes = Buffer.from(await audioResponse.arrayBuffer());
          if (!bytes.length) throw new Error("Audio download was empty.");
          filename = buildEnglishWordAudioFilename({ englishWordId: row.id });
          await writeFile(getEnglishWordAudioAbsolutePath(filename), bytes);
        }
        const shouldUpdatePhonetic = !row.phonetic_us;
        await prisma.englishWord.update({ where: { id: row.id }, data: {
          ...(shouldUpdatePhonetic ? { phonetic_us: pronunciation.phonetic_us, phonetic_us_confirmed: false, phonetic_us_normalized: normalizeIpaForDb(pronunciation.phonetic_us, 2000) || null, json_hint: null } : {}),
          ...(filename ? { audio_file_name: filename } : {}),
        } });
        if (shouldUpdatePhonetic) await touchWordsByEnglishId(row.id);
        if (shouldUpdatePhonetic) report.updatedPhonetic += 1;
        if (filename) report.downloadedAudio += 1;
      } catch (error) {
        const isRateLimited = error instanceof DictionaryApiRequestError && error.status === 429;
        if (isRateLimited) report.rateLimited += 1; else report.failed += 1;
        if (report.details.length < 30) report.details.push({ id: row.id, base_form: row.base_form, outcome: isRateLimited ? "rate_limited" : "failed", detail: error instanceof Error ? error.message : String(error) });
      }
    }
    return NextResponse.json({ ok: true, report, nextAfterId: rows.at(-1)?.id ?? afterId, remainingInNextRun: rows.length === BATCH_SIZE });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not import US pronunciations." }, { status: 500 });
  }
}
