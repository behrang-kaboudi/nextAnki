import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function asNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function addYeIfEndsWithVavOrAlef(value) {
  const last = value.at(-1);
  if (last === "و" || last === "ا") return `${value}ی`;
  return value;
}

function parseJsonHint(jsonHint) {
  if (jsonHint == null) return null;
  if (typeof jsonHint === "string") {
    const raw = jsonHint.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof jsonHint === "object") return jsonHint;
  return null;
}

function formatPersonAdjJobFa(obj) {
  const personFaRaw = asNonEmptyString(obj?.person?.fa);
  const personFa = personFaRaw ? addYeIfEndsWithVavOrAlef(personFaRaw) : null;

  const parts = [personFa, asNonEmptyString(obj?.adj?.fa), asNonEmptyString(obj?.job?.fa)].filter(
    Boolean
  );
  return parts.length ? parts.join(" ") : null;
}

function formatHintSentenceFromJsonHint(jsonHint) {
  const obj = parseJsonHint(jsonHint);
  const basePhrase = formatPersonAdjJobFa(obj);
  const persianImageFa = asNonEmptyString(obj?.persianImage?.fa);

  const parts = [];
  if (basePhrase) parts.push(basePhrase);
  if (persianImageFa) parts.push("کنار", persianImageFa);
  return parts.length ? parts.join(" ") : null;
}

async function main() {
  const take = 500;
  let cursorId = null;
  let scanned = 0;
  let updated = 0;

  for (;;) {
    const rows = await prisma.word.findMany({
      orderBy: { id: "asc" },
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: { id: true, json_hint: true },
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      scanned += 1;
      const hint_sentence = formatHintSentenceFromJsonHint(r.json_hint);
      await prisma.word.update({
        where: { id: r.id },
        data: { hint_sentence },
        select: { id: true },
      });
      updated += 1;
    }

    cursorId = rows[rows.length - 1].id;
    process.stdout.write(`\rscanned=${scanned} updated=${updated} lastId=${cursorId}`);
  }

  process.stdout.write(`\nDone. scanned=${scanned} updated=${updated}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

