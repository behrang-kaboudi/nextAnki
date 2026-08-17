import "dotenv/config";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const INPUT_FILE = "structurally-valid-vocabulary-source-backed.json";
const OUTPUT_FILE = "structurally-valid-vocabulary-source-backed-with-database.json";

function jsonIds(value) {
  return Array.isArray(value) ? value.filter((item) => Number.isInteger(item) && item > 0) : [];
}

function validExample(sentence) {
  const wordCount = sentence.sentence_en?.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
  return wordCount >= 6 && wordCount <= 14
    && /[.!?]$/u.test(sentence.sentence_en?.trim() ?? "")
    && /[\u0600-\u06ff]/u.test(sentence.sentence_en_meaning_fa ?? "");
}

const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
const targetIds = [...new Set(data.entries
  .filter((entry) => entry.status !== "completed_existing" && entry.database_before_enrichment?.pair_exists)
  .flatMap((entry) => entry.database_before_enrichment.word_sense_ids ?? []))];
const prisma = new PrismaClient();
try {
  const wordSenses = await prisma.wordSense.findMany({
    where: { id: { in: targetIds } },
    select: {
      id: true,
      pos: true,
      concept_explained_fa: true,
      otherMeaningIds: true,
      sentenceIds: true,
    },
  });
  const persianIds = [...new Set(wordSenses.flatMap((wordSense) => jsonIds(wordSense.otherMeaningIds)))];
  const sentenceIds = [...new Set(wordSenses.flatMap((wordSense) => jsonIds(wordSense.sentenceIds)))];
  const [persianWords, sentences] = await Promise.all([
    prisma.persianWord.findMany({ where: { id: { in: persianIds } }, select: { id: true, canonical_text: true } }),
    prisma.sentence.findMany({ where: { id: { in: sentenceIds } }, select: { id: true, sentence_en: true, sentence_en_meaning_fa: true } }),
  ]);
  const persianById = new Map(persianWords.map((item) => [item.id, item.canonical_text]));
  const sentenceById = new Map(sentences.map((item) => [item.id, item]));
  const wordSenseById = new Map(wordSenses.map((item) => [item.id, item]));
  let completedFromDatabase = 0;
  let partiallyBackedByDatabase = 0;
  const entries = data.entries.map((entry) => {
    if (entry.status === "completed_existing" || !entry.database_before_enrichment?.pair_exists) return entry;
    const wordSense = (entry.database_before_enrichment.word_sense_ids ?? []).map((id) => wordSenseById.get(id)).find(Boolean);
    if (!wordSense) return entry;
    const example = jsonIds(wordSense.sentenceIds).map((id) => sentenceById.get(id)).find((item) => item && validExample(item)) ?? null;
    const concept = wordSense.concept_explained_fa?.trim() || null;
    const pos = wordSense.pos?.trim() || entry.pos || null;
    const otherMeanings = jsonIds(wordSense.otherMeaningIds).map((id) => persianById.get(id)).filter(Boolean).slice(0, 3);
    const missingFields = [
      ...(!pos ? ["pos"] : []),
      ...(!concept ? ["concept_explained_fa"] : []),
      ...(!example ? ["sentence_en", "sentence_en_meaning_fa"] : []),
    ];
    if (missingFields.length) partiallyBackedByDatabase += 1;
    else completedFromDatabase += 1;
    return {
      ...entry,
      pos,
      concept_explained_fa: concept,
      other_meanings_fa: otherMeanings.length ? otherMeanings : (entry.other_meanings_fa ?? []),
      sentence_en: example?.sentence_en ?? entry.sentence_en ?? null,
      sentence_en_meaning_fa: example?.sentence_en_meaning_fa ?? entry.sentence_en_meaning_fa ?? null,
      confidence: "database_exact_pair",
      field_origins: {
        meaning_fa: "database",
        other_meanings_fa: otherMeanings.length ? "database" : entry.field_origins?.other_meanings_fa ?? null,
        pos: wordSense.pos?.trim() ? "database" : entry.field_origins?.pos ?? null,
        concept_explained_fa: concept ? "database" : null,
        sentence_en: example ? "database" : entry.field_origins?.sentence_en ?? null,
        sentence_en_meaning_fa: example ? "database" : entry.field_origins?.sentence_en_meaning_fa ?? null,
      },
      status: missingFields.length ? "database_backed_needs_generation" : "completed_from_database",
      missing_fields: missingFields,
    };
  });
  const counts = entries.reduce((result, entry) => {
    result[entry.status] = (result[entry.status] ?? 0) + 1;
    return result;
  }, {});
  const result = {
    ...data,
    generated_at: new Date().toISOString(),
    database_snapshot_read_at: new Date().toISOString(),
    database_written: false,
    entries,
    stats: { total_entries: entries.length, ...counts, completed_from_database: completedFromDatabase, partially_backed_by_database: partiallyBackedByDatabase },
  };
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(result)}\n`);
  process.stdout.write(`${JSON.stringify({ output_file: OUTPUT_FILE, ...result.stats }, null, 2)}\n`);
} finally {
  await prisma.$disconnect();
}
