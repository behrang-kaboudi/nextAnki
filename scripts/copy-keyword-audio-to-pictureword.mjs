import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { PrismaClient } from "@prisma/client";

const SOURCE_DIR =
  "/Users/seyedbehrangkaboudi/Downloads/Projects/EnglishLearning/apps/api/public/audio/keys";
const DEST_DIR =
  "/Users/seyedbehrangkaboudi/Downloads/Projects/NextJS/Anki/public/audio/pictureWord";
const KEYWORDS_SOURCE_JS =
  "/Users/seyedbehrangkaboudi/Downloads/Projects/EnglishLearning/apps/api/src/models/words/ipa/ipaKeyWords2.js";

function normalizeFa(value) {
  return (
    String(value ?? "")
      // ZWNJ -> space
      .replace(/\u200c/g, " ")
      // strip Arabic diacritics (harakat) + tatweel
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      // collapse spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

function safeSlugPart(input) {
  const s = String(input ?? "").trim().toLowerCase();
  return s
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function pictureWordAudioKey(phinglish, en) {
  const a = safeSlugPart(phinglish);
  const b = safeSlugPart(en);
  return `${a}__${b}`;
}

function buildPictureWordAudioFilename({ phinglish, en, timestampMs, rmsDb, peakDb, ext }) {
  const key = pictureWordAudioKey(phinglish, en);
  const ts = Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : Date.now();
  const rms = rmsDb == null || !Number.isFinite(rmsDb) ? "na" : String(Math.round(rmsDb * 10));
  const peak = peakDb == null || !Number.isFinite(peakDb) ? "na" : String(Math.round(peakDb * 10));
  const cleanExt = String(ext || "mp3")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${key}__${ts}__r${rms}__p${peak}.${cleanExt}`;
}

async function listLatestAudioByNumber(dir) {
  const files = await fs.readdir(dir).catch(() => []);
  const candidates = new Map(); // number -> { file, mtimeMs }

  for (const name of files) {
    if (!name.endsWith(".mp3")) continue;
    const m = /^(\d+)_KeyWord.*\.mp3$/i.exec(name);
    if (!m) continue;
    const number = Number(m[1]);
    if (!Number.isFinite(number)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    const prev = candidates.get(number);
    if (!prev || st.mtimeMs > prev.mtimeMs) candidates.set(number, { file: name, mtimeMs: st.mtimeMs });
  }

  return candidates;
}

function parseOldFilename(name) {
  // Old expected: <number>_KeyWord_<ts>_V<rms10>_P<peak10>.mp3
  // Also accept: <number>_KeyWord_<ts>.mp3
  const m = /_KeyWord_(\d+)(?:_V(-?\d+)_P(-?\d+))?\.mp3$/i.exec(String(name));
  if (!m) return { timestampMs: null, rmsDb: null, peakDb: null };
  const ts = Number(m[1]);
  const rms10 = m[2] != null ? Number(m[2]) : null;
  const peak10 = m[3] != null ? Number(m[3]) : null;
  return {
    timestampMs: Number.isFinite(ts) ? ts : null,
    rmsDb: rms10 == null || !Number.isFinite(rms10) ? null : rms10 / 10,
    peakDb: peak10 == null || !Number.isFinite(peak10) ? null : peak10 / 10,
  };
}

async function main() {
  const prisma = new PrismaClient();
  const tempPath = path.join(os.tmpdir(), `anki-audio-copy-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  const report = {
    sourceDir: SOURCE_DIR,
    destDir: DEST_DIR,
    totals: { keywords: 0, pictureWords: 0, matched: 0, copied: 0, skippedNoAudio: 0, skippedDupPictureWord: 0, skippedExists: 0 },
    copied: [],
    skipped: [],
  };

  try {
    await fs.mkdir(DEST_DIR, { recursive: true });

    const keywordsModule = await import(KEYWORDS_SOURCE_JS).catch(() => null);
    const keywordsList = Array.isArray(keywordsModule?.ipaMap2) ? keywordsModule.ipaMap2 : [];

    const pictureWords = await prisma.pictureWord.findMany({ select: { id: true, fa: true, phinglish: true, en: true } });

    report.totals.keywords = keywordsList.length;
    report.totals.pictureWords = pictureWords.length;

    const audioByNumber = await listLatestAudioByNumber(SOURCE_DIR);
    const keywordNumbersByFaPlain = new Map(); // faPlainNorm -> number[]
    for (const kw of keywordsList) {
      const number = Number(kw?.number);
      if (!Number.isFinite(number)) continue;
      const k = normalizeFa(kw?.fa);
      if (!k) continue;
      const arr = keywordNumbersByFaPlain.get(k) ?? [];
      arr.push(number);
      keywordNumbersByFaPlain.set(k, arr);
    }

    const usedPictureWordIds = new Set();

    for (const pw of pictureWords) {
      const faNorm = normalizeFa(pw.fa);
      if (!faNorm) continue;
      const candidates = keywordNumbersByFaPlain.get(faNorm) ?? [];
      if (!candidates.length) continue;
      report.totals.matched++;

      if (usedPictureWordIds.has(pw.id)) {
        report.totals.skippedDupPictureWord++;
        report.skipped.push({ reason: "dupPictureWord", pictureWordId: pw.id, fa: pw.fa });
        continue;
      }

      const withAudio = candidates.find((n) => audioByNumber.get(n)?.file);
      if (!withAudio) {
        report.totals.skippedNoAudio++;
      report.skipped.push({ reason: "noAudioForFa", fa: pw.fa, pictureWordId: pw.id, candidates: candidates.slice(0, 10) });
      continue;
    }

      const audio = audioByNumber.get(withAudio);

      const parsed = parseOldFilename(audio.file);
      const newName = buildPictureWordAudioFilename({
        phinglish: pw.phinglish,
        en: pw.en,
        timestampMs: parsed.timestampMs ?? Date.now(),
        rmsDb: parsed.rmsDb,
        peakDb: parsed.peakDb,
        ext: "mp3",
      });

      const from = path.join(SOURCE_DIR, audio.file);
      const to = path.join(DEST_DIR, newName);

      try {
        await fs.access(to);
        report.totals.skippedExists++;
        report.skipped.push({
          reason: "destExists",
          number: kw.number,
          from: audio.file,
          to: newName,
          pictureWordId: pw.id,
        });
        usedPictureWordIds.add(pw.id);
        continue;
      } catch {}

      await fs.copyFile(from, to);
      report.totals.copied++;
      usedPictureWordIds.add(pw.id);
      report.copied.push({
        number: withAudio,
        fa: pw.fa,
        pictureWordId: pw.id,
        phinglish: pw.phinglish,
        en: pw.en,
        from: audio.file,
        to: newName,
      });
    }

    await fs.writeFile(tempPath, JSON.stringify(report, null, 2), "utf8");
    process.stdout.write(`Temp report: ${tempPath}\n`);
    process.stdout.write(JSON.stringify(report.totals) + "\n");
  } finally {
    await prisma.$disconnect().catch(() => {});
    // delete temp report as requested
    // (leave it briefly only for debugging if needed; comment out next line)
    // eslint-disable-next-line no-console
    try {
      await fs.rm(tempPath, { force: true });
    } catch {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
