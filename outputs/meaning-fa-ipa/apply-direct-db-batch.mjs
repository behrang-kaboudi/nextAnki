import "dotenv/config";

import { Prisma, PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const manifestPath = process.argv[2];
const execute = process.argv.includes("--execute");

if (!manifestPath) {
  throw new Error("Usage: node outputs/meaning-fa-ipa/apply-direct-db-batch.mjs <manifest.json> [--execute]");
}

const items = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
if (!Array.isArray(items) || items.length === 0) throw new Error("Manifest must be a non-empty array.");

const ids = new Set();
for (const [index, item] of items.entries()) {
  if (!item || Object.keys(item).sort().join(",") !== "canonical_text,id,meaning_fa_IPA") {
    throw new Error(`Invalid keys at index ${index}.`);
  }
  if (!Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) throw new Error(`Invalid or duplicate id at index ${index}.`);
  if (typeof item.canonical_text !== "string" || !item.canonical_text.trim()) throw new Error(`Invalid canonical_text for ${item.id}.`);
  if (typeof item.meaning_fa_IPA !== "string" || !item.meaning_fa_IPA.trim() || item.meaning_fa_IPA.includes("/")) {
    throw new Error(`Invalid meaning_fa_IPA for ${item.id}.`);
  }
  ids.add(item.id);
}

const prisma = new PrismaClient();
try {
  const current = await prisma.persianWord.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      canonical_text: true,
      meaning_fa_IPA: true,
      meaning_fa_IPA_normalize: true,
      meaning_fa_IPA_confirmed: true,
    },
  });
  const byId = new Map(current.map((row) => [row.id, row]));
  const normalizedBefore = new Map(current.map((row) => [row.id, row.meaning_fa_IPA_normalize]));
  const eligible = [];
  const stale = [];
  for (const item of items) {
    const row = byId.get(item.id);
    if (!row) stale.push({ id: item.id, reason: "missing" });
    else if (row.canonical_text !== item.canonical_text) stale.push({ id: item.id, reason: "canonical_text_changed" });
    else if (row.meaning_fa_IPA !== null && row.meaning_fa_IPA !== "") stale.push({ id: item.id, reason: "ipa_already_populated" });
    else eligible.push(item);
  }

  if (!execute) {
    console.log(JSON.stringify({ mode: "dry-run", total: items.length, eligible: eligible.length, stale }, null, 2));
    process.exitCode = stale.length ? 2 : 0;
  } else {
    const result = await prisma.$transaction(async (tx) => {
      const updated = [];
      const skipped = [...stale];
      for (const item of eligible) {
        const write = await tx.persianWord.updateMany({
          where: {
            id: item.id,
            canonical_text: item.canonical_text,
            OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }],
          },
          data: {
            meaning_fa_IPA: item.meaning_fa_IPA.trim(),
            meaning_fa_IPA_confirmed: true,
          },
        });
        if (write.count === 1) updated.push(item.id);
        else skipped.push({ id: item.id, reason: "changed_during_transaction" });
      }
      return { updated, skipped };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });

    const verified = await prisma.persianWord.findMany({
      where: { id: { in: result.updated } },
      select: { id: true, canonical_text: true, meaning_fa_IPA: true, meaning_fa_IPA_normalize: true, meaning_fa_IPA_confirmed: true },
    });
    const expected = new Map(items.map((item) => [item.id, item]));
    const verificationFailures = verified.flatMap((row) => {
      const item = expected.get(row.id);
      return item && row.canonical_text === item.canonical_text && row.meaning_fa_IPA === item.meaning_fa_IPA.trim() && row.meaning_fa_IPA_confirmed === true && row.meaning_fa_IPA_normalize === normalizedBefore.get(row.id)
        ? []
        : [{ id: row.id, row }];
    });
    console.log(JSON.stringify({ mode: "execute", total: items.length, updated: result.updated.length, skipped: result.skipped, verified: verified.length, verificationFailures }, null, 2));
    if (verificationFailures.length) process.exitCode = 3;
  }
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(JSON.stringify({ code: error.code, message: error.message }, null, 2));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
