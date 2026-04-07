import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "words");
const FIELDS = new Set(["sentence_en", "sentence_en_meaning_fa"]);
const NEW_SEP = "__";

function parseFilename(filename) {
  if (!filename.endsWith(".mp3")) return null;

  const withoutExt = filename.slice(0, -4);
  if (withoutExt.includes(NEW_SEP)) {
    const parts = withoutExt.split(NEW_SEP);
    if (parts.length === 3) {
      const [key, field, ts] = parts;
      if (FIELDS.has(field) && /^\d{8,}$/.test(ts)) {
        return { key, field, ts, format: "new" };
      }
    }
  }

  const legacy = /^(?<key>.+)_(?<field>sentence_en|sentence_en_meaning_fa)_(?<ts>\d{8,})\.mp3$/u.exec(filename);
  if (!legacy?.groups) return null;
  return {
    key: legacy.groups.key,
    field: legacy.groups.field,
    ts: legacy.groups.ts,
    format: "legacy",
  };
}

async function main() {
  const dryRun = (process.env.DRY_RUN ?? "false").trim().toLowerCase() !== "false";

  let files = [];
  try {
    files = fs.readdirSync(AUDIO_DIR).filter((name) => name && !name.startsWith("."));
  } catch (error) {
    throw new Error(`Failed to read audio dir: ${error instanceof Error ? error.message : String(error)}`);
  }

  const sentences = await prisma.sentence.findMany({
    where: { anki_link_id: { not: null } },
    select: { id: true, anki_link_id: true },
  });
  const sentenceIdByAnkiLinkId = new Map(
    sentences
      .filter((row) => row.anki_link_id)
      .map((row) => [String(row.anki_link_id).trim(), row.id]),
  );

  let scanned = 0;
  let renamed = 0;
  let skippedAlreadyNew = 0;
  let skippedNoMatch = 0;
  let skippedTargetExists = 0;

  for (const filename of files) {
    const parsed = parseFilename(filename);
    if (!parsed) continue;
    scanned += 1;

    const mappedSentenceId = sentenceIdByAnkiLinkId.get(parsed.key);
    if (!mappedSentenceId) {
      if (parsed.format === "new") skippedAlreadyNew += 1;
      else skippedNoMatch += 1;
      continue;
    }

    const nextFilename = `${mappedSentenceId}${NEW_SEP}${parsed.field}${NEW_SEP}${parsed.ts}.mp3`;
    if (nextFilename === filename) {
      skippedAlreadyNew += 1;
      continue;
    }

    const fromAbs = path.join(AUDIO_DIR, filename);
    const toAbs = path.join(AUDIO_DIR, nextFilename);

    if (fs.existsSync(toAbs)) {
      skippedTargetExists += 1;
      process.stdout.write(`skip target exists: ${filename} -> ${nextFilename}\n`);
      continue;
    }

    if (!dryRun) fs.renameSync(fromAbs, toAbs);
    renamed += 1;
    process.stdout.write(`${dryRun ? "[dryRun] " : ""}rename ${filename} -> ${nextFilename}\n`);
  }

  process.stdout.write(
    `Done. scanned=${scanned} renamed=${renamed} skippedAlreadyNew=${skippedAlreadyNew} skippedNoMatch=${skippedNoMatch} skippedTargetExists=${skippedTargetExists} dryRun=${dryRun}\n`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
