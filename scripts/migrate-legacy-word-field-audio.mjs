import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const projectDir = process.cwd();
const oldDir = path.join(projectDir, "public", "audio", "words");
const englishDir = path.join(projectDir, "public", "audio", "english-words");
const conceptDir = path.join(projectDir, "public", "audio", "word-concepts");
const fields = ["base_form", "concept_explained_fa"];

function sanitize(value) {
  const cleaned = String(value ?? "").trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.length ? cleaned.slice(0, 120) : "unknown";
}

function parse(filename) {
  if (!filename.endsWith(".mp3")) return null;
  for (const field of fields) {
    const marker = `__${field}__`;
    const markerIndex = filename.lastIndexOf(marker);
    if (markerIndex > 0) {
      const timestampMs = Number(filename.slice(markerIndex + marker.length, -4));
      if (Number.isSafeInteger(timestampMs) && timestampMs > 0) {
        return { audioKey: filename.slice(0, markerIndex), field, timestampMs };
      }
    }
    const legacy = new RegExp(`^(?<audioKey>.+)_${field}_(?<timestamp>\\d{8,})\\.mp3$`).exec(filename);
    const timestampMs = Number(legacy?.groups?.timestamp);
    if (legacy?.groups?.audioKey && Number.isSafeInteger(timestampMs) && timestampMs > 0) {
      return { audioKey: legacy.groups.audioKey, field, timestampMs };
    }
  }
  return null;
}

async function existsNonEmpty(filename) {
  if (!filename) return false;
  try {
    return (await fs.stat(filename)).size > 0;
  } catch {
    return false;
  }
}

async function sha256(filename) {
  return crypto.createHash("sha256").update(await fs.readFile(filename)).digest("hex");
}

async function copyVerified(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  if (await sha256(source) !== await sha256(destination)) {
    throw new Error(`Hash mismatch: ${source} -> ${destination}`);
  }
}

async function main() {
  const [entries, words] = await Promise.all([
    fs.readdir(oldDir),
    prisma.word.findMany({
      select: {
        id: true,
        anki_link_id: true,
        concept_explained_fa: true,
        concept_explained_fa_audio_file_name: true,
        english: { select: { id: true, audio_file_name: true } },
      },
    }),
  ]);
  const candidates = [];
  for (const filename of entries) {
    const parsed = parse(filename);
    if (!parsed) continue;
    const size = (await fs.stat(path.join(oldDir, filename))).size;
    candidates.push({ filename, size, ...parsed });
  }
  const wordByAudioKey = new Map(words.map((word) => [sanitize(word.anki_link_id), word]));
  const grouped = new Map();
  for (const candidate of candidates) {
    const word = wordByAudioKey.get(candidate.audioKey);
    if (!word) continue;
    const key = `${word.id}:${candidate.field}`;
    const values = grouped.get(key) ?? [];
    values.push(candidate);
    grouped.set(key, values);
  }

  const missingBaseReplacements = [];
  for (const [key, values] of grouped) {
    if (!key.endsWith(":base_form")) continue;
    const wordId = Number(key.split(":")[0]);
    const word = words.find((item) => item.id === wordId);
    const replacement = word?.english.audio_file_name
      ? path.join(englishDir, word.english.audio_file_name)
      : null;
    if (!replacement || !(await existsNonEmpty(replacement))) {
      missingBaseReplacements.push({ wordId, oldFiles: values.map((item) => item.filename) });
    }
  }
  if (missingBaseReplacements.length) {
    throw new Error(`Cannot remove base_form legacy files; ${missingBaseReplacements.length} active Word records have no valid EnglishWord audio replacement.`);
  }

  let migratedConcept = 0;
  for (const [key, values] of grouped) {
    const [wordIdRaw, field] = key.split(":");
    if (field === "base_form") continue;
    const wordId = Number(wordIdRaw);
    const word = words.find((item) => item.id === wordId);
    if (!word) continue;
    const sourceText = word.concept_explained_fa?.trim();
    if (!sourceText) continue;
    const currentFilename = word.concept_explained_fa_audio_file_name;
    const destinationDir = conceptDir;
    if (currentFilename && await existsNonEmpty(path.join(destinationDir, currentFilename))) continue;
    const selected = values.filter((item) => item.size > 0).sort((a, b) => b.timestampMs - a.timestampMs)[0];
    if (!selected) continue;
    const newFilename = `w__${wordId}__${field}__${selected.timestampMs}.mp3`;
    if (apply) {
      await copyVerified(path.join(oldDir, selected.filename), path.join(destinationDir, newFilename));
      await prisma.word.update({
        where: { id: wordId },
        data: {
          concept_explained_fa_audio_file_name: newFilename,
          concept_explained_fa_audio_source_text: sourceText,
        },
      });
    }
    migratedConcept += 1;
  }

  if (apply) {
    for (const candidate of candidates) await fs.rm(path.join(oldDir, candidate.filename), { force: true });
  }
  const matched = candidates.filter((item) => wordByAudioKey.has(item.audioKey)).length;
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    legacyFiles: candidates.length,
    matchedFiles: matched,
    unmatchedFiles: candidates.length - matched,
    migratedConcept,
    removedLegacyFiles: apply ? candidates.length : 0,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
