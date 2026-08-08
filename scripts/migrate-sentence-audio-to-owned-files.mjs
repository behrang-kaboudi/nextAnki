import fs from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const projectDir = process.cwd();
const legacyDir = path.join(projectDir, "public", "audio", "words");
const sentenceDir = path.join(projectDir, "public", "audio", "sentences");
const unlinkedDir = path.join(sentenceDir, "legacy-unlinked");
const fields = ["sentence_en", "sentence_en_meaning_fa"];

function parseLegacy(filename) {
  for (const field of fields) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`^(?<id>\\d+)(?:__|_)${escaped}(?:__|_)(?<timestamp>\\d{8,})\\.mp3$`).exec(filename);
    if (match?.groups) return { id: Number(match.groups.id), field, timestamp: Number(match.groups.timestamp) };
  }
  return null;
}

function parseOwned(filename) {
  const match = /^s__(?<id>\d+)__(?<field>sentence_en|sentence_en_meaning_fa)__(?<timestamp>\d{8,})\.mp3$/.exec(filename);
  return match?.groups
    ? { id: Number(match.groups.id), field: match.groups.field, timestamp: Number(match.groups.timestamp) }
    : null;
}

function ownedFilename(item) {
  return `s__${item.id}__${item.field}__${item.timestamp}.mp3`;
}

async function entries(dir) {
  try {
    return await fs.readdir(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  await fs.mkdir(sentenceDir, { recursive: true });
  await fs.mkdir(unlinkedDir, { recursive: true });
  let moved = 0;
  let movedUnlinked = 0;
  let archivedObsolete = 0;
  let alreadyOwned = 0;
  const candidates = [];

  for (const filename of await entries(legacyDir)) {
    const parsed = parseLegacy(filename);
    if (!parsed) {
      if (/^.+__(?:sentence_en|sentence_en_meaning_fa)__\d{8,}\.mp3$/.test(filename)) {
        await fs.rename(path.join(legacyDir, filename), path.join(unlinkedDir, filename));
        movedUnlinked += 1;
      }
      continue;
    }
    const nextFilename = ownedFilename(parsed);
    const source = path.join(legacyDir, filename);
    const target = path.join(sentenceDir, nextFilename);
    try {
      await fs.rename(source, target);
      moved += 1;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const [sourceBytes, targetBytes] = await Promise.all([fs.readFile(source), fs.readFile(target)]);
      if (!sourceBytes.equals(targetBytes)) throw new Error(`Conflicting destination file: ${nextFilename}`);
      await fs.rm(source);
    }
    const stat = await fs.stat(target);
    candidates.push({ ...parsed, filename: nextFilename, size: stat.size });
  }

  for (const filename of await entries(sentenceDir)) {
    const parsed = parseOwned(filename);
    if (!parsed) continue;
    const stat = await fs.stat(path.join(sentenceDir, filename));
    candidates.push({ ...parsed, filename, size: stat.size });
    alreadyOwned += 1;
  }

  const latest = new Map();
  for (const item of candidates) {
    if (item.size <= 0) continue;
    const key = `${item.id}:${item.field}`;
    const previous = latest.get(key);
    if (!previous || item.timestamp > previous.timestamp) latest.set(key, item);
  }

  const rows = await prisma.sentence.findMany({
    select: {
      id: true,
      sentence_en_audio_file_name: true,
      sentence_en_meaning_fa_audio_file_name: true,
    },
  });
  let updatedRows = 0;
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200);
    const updates = batch.flatMap((row) => {
      const { id } = row;
      const sentenceEn = latest.get(`${id}:sentence_en`)?.filename ?? null;
      const meaningFa = latest.get(`${id}:sentence_en_meaning_fa`)?.filename ?? null;
      if (row.sentence_en_audio_file_name === sentenceEn && row.sentence_en_meaning_fa_audio_file_name === meaningFa) return [];
      updatedRows += 1;
      return [prisma.sentence.update({
        where: { id },
        data: {
          sentence_en_audio_file_name: sentenceEn,
          sentence_en_meaning_fa_audio_file_name: meaningFa,
        },
      })];
    });
    if (updates.length) await prisma.$transaction(updates);
  }

  const validIds = new Set(rows.map((row) => row.id));
  const seenFilenames = new Set();
  for (const item of candidates) {
    if (seenFilenames.has(item.filename)) continue;
    seenFilenames.add(item.filename);
    const selected = latest.get(`${item.id}:${item.field}`)?.filename;
    if (validIds.has(item.id) && selected === item.filename) continue;
    try {
      await fs.rename(path.join(sentenceDir, item.filename), path.join(unlinkedDir, item.filename));
      archivedObsolete += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  console.log(JSON.stringify({ moved, movedUnlinked, archivedObsolete, alreadyOwned, indexed: latest.size, sentenceRows: rows.length, updatedRows }, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
