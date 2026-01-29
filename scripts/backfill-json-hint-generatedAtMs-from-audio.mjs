import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function audioDir() {
  return path.join(process.cwd(), "public", "audio");
}

function listFiles() {
  try {
    return fs.readdirSync(audioDir());
  } catch {
    return [];
  }
}

function buildLatestTimestampMap() {
  const re = /^(?<id>\d+)_hint_(?<ts>\d{8,})\.mp3$/i;
  const latest = new Map();

  for (const filename of listFiles()) {
    const m = re.exec(filename);
    const id = Number(m?.groups?.id);
    const ts = Number(m?.groups?.ts);
    if (!Number.isFinite(id) || id <= 0) continue;
    if (!Number.isFinite(ts)) continue;
    const prev = latest.get(id);
    if (typeof prev !== "number" || ts > prev) latest.set(id, Math.trunc(ts));
  }

  return latest;
}

function parseJson(jsonHint) {
  if (typeof jsonHint !== "string") return null;
  const raw = jsonHint.trim();
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

async function main() {
  const dryRun = (process.env.DRY_RUN ?? "true").trim().toLowerCase() !== "false";
  const take = Number.parseInt(process.env.BATCH ?? "500", 10) || 500;

  const latestMap = buildLatestTimestampMap();
  console.log(`Audio map: ${latestMap.size} ids`);

  let cursorId = null;
  let scanned = 0;
  let updated = 0;
  let skippedNoAudio = 0;
  let skippedNoJson = 0;
  let skippedInvalidJson = 0;
  let skippedSame = 0;

  for (;;) {
    const rows = await prisma.word.findMany({
      orderBy: { id: "asc" },
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, json_hint: true },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const ts = latestMap.get(row.id);
      if (!ts) {
        skippedNoAudio += 1;
        cursorId = row.id;
        continue;
      }

      if (!row.json_hint) {
        skippedNoJson += 1;
        cursorId = row.id;
        continue;
      }

      const obj = parseJson(row.json_hint);
      if (!obj) {
        skippedInvalidJson += 1;
        cursorId = row.id;
        continue;
      }

      if (obj.generatedAtMs === ts) {
        skippedSame += 1;
        cursorId = row.id;
        continue;
      }

      obj.generatedAtMs = ts;
      const nextJson = JSON.stringify(obj);

      if (!dryRun) {
        await prisma.word.update({
          where: { id: row.id },
          data: { json_hint: nextJson },
        });
      }
      updated += 1;
      cursorId = row.id;
    }

    process.stdout.write(
      `\rscanned=${scanned} updated=${updated} noAudio=${skippedNoAudio} noJson=${skippedNoJson} invalidJson=${skippedInvalidJson} same=${skippedSame} lastId=${cursorId}`
    );
  }

  process.stdout.write(
    `\nDone. scanned=${scanned} updated=${updated} noAudio=${skippedNoAudio} noJson=${skippedNoJson} invalidJson=${skippedInvalidJson} same=${skippedSame} dryRun=${dryRun}\n`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

