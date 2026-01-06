import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const sourcePath =
  process.env.IPA_MAP2_TS_PATH ||
  path.join(process.cwd(), "src/lib/ipa/ipaKeyWords2.ts");

function stripArabicDiacritics(input) {
  if (!input) return "";
  return input
    .normalize("NFC")
    .replace(/[\u0640\u0670]/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[\u06D6-\u06ED]/g, "")
    .trim();
}

function extractIpaMap2ArrayText(fileText) {
  const exportIdx = fileText.indexOf("export const ipaMap2");
  if (exportIdx === -1) {
    throw new Error("Could not find `export const ipaMap2` in source file.");
  }

  const startBracket = fileText.indexOf("[", exportIdx);
  if (startBracket === -1) {
    throw new Error("Could not find `[` after `export const ipaMap2`.");
  }

  const endMarker = fileText.indexOf("];", startBracket);
  if (endMarker === -1) {
    throw new Error("Could not find closing `];` for `ipaMap2`.");
  }

  return fileText.slice(startBracket, endMarker + 1);
}

function stripLineComments(text) {
  return text.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function parseIpaMap2(fileText) {
  const arrayText = extractIpaMap2ArrayText(fileText);
  const withoutComments = stripLineComments(arrayText);

  let data;
  try {
    // We intentionally evaluate a local, trusted source file in a controlled way.
    // The array contains only object literals with string/number fields.
    // eslint-disable-next-line no-new-func
    data = Function(`"use strict"; return (${withoutComments});`)();
  } catch (error) {
    throw new Error(`Failed to parse ipaMap2 from TS source: ${error?.message || error}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("Parsed ipaMap2 is not an array.");
  }

  const rows = [];
  let skipped = 0;

  for (const item of data) {
    const number = item?.number;
    const fa = item?.fa;
    const ipa_fa = item?.ipa_fa;

    if (typeof number !== "number" || !Number.isFinite(number)) {
      skipped += 1;
      continue;
    }
    if (typeof fa !== "string" || !fa.trim()) {
      skipped += 1;
      continue;
    }
    if (typeof ipa_fa !== "string" || !ipa_fa.trim()) {
      skipped += 1;
      continue;
    }

    rows.push({ number, fa, faPlain: stripArabicDiacritics(fa), ipa_fa });
  }

  return { rows, skipped, total: data.length };
}

async function main() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  const raw = fs.readFileSync(sourcePath, "utf8");
  const { rows, skipped, total } = parseIpaMap2(raw);

  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const result = await prisma.ipaKeyword.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`Inserted so far: ${inserted}/${rows.length}`);
  }

  console.log(
    `Done. Total in source: ${total}, prepared: ${rows.length}, inserted: ${inserted}, skipped: ${skipped}`,
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
