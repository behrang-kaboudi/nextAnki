import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGETS = [
  {
    base_form: "key",
    meaning_fa: "کلید",
    sentence_en: "I left the key on the kitchen counter this morning.",
  },
  {
    base_form: "shoe",
    meaning_fa: "کفش",
    sentence_en: "This shoe hurts my heel after walking a few blocks.",
  },
  {
    base_form: "toy",
    meaning_fa: "اسباب‌بازی",
    sentence_en: "The child refused to sleep without his favorite toy.",
  },
  {
    base_form: "egg",
    meaning_fa: "تخم‌مرغ",
    sentence_en: "She cracked an egg into the pan for breakfast.",
  },
  {
    base_form: "tea",
    meaning_fa: "چای",
    sentence_en: "I usually drink tea in the afternoon to relax.",
  },
  {
    base_form: "bee",
    meaning_fa: "زنبور",
    sentence_en: "A bee landed on my arm while I was gardening.",
  },
  {
    base_form: "cow",
    meaning_fa: "گاو",
    sentence_en: "The cow stood quietly in the field chewing grass.",
  },
  {
    base_form: "pie",
    meaning_fa: "پای (کیک)",
    sentence_en: "She baked an apple pie for the family dinner.",
  },
  {
    base_form: "bow",
    meaning_fa: "پاپیون",
    sentence_en: "She tied a red bow around the gift box.",
  },
  {
    base_form: "pea",
    meaning_fa: "نخودفرنگی",
    sentence_en: "He picked a pea off his plate and laughed.",
  },
];

async function main() {
  const dryRun = (process.env.DRY_RUN ?? "true").trim().toLowerCase() !== "false";

  let scannedTargets = 0;
  let matchedRows = 0;
  let updatedRows = 0;

  for (const t of TARGETS) {
    scannedTargets += 1;

    const rows = await prisma.word.findMany({
      where: {
        base_form: t.base_form,
        meaning_fa: t.meaning_fa,
        sentence_en: t.sentence_en,
        anki_link_id: { startsWith: "temp_" },
      },
      select: { id: true, meaning_fa: true, meaning_fa_IPA: true, anki_link_id: true },
    });

    matchedRows += rows.length;
    for (const row of rows) {
      const shouldClear = row.meaning_fa_IPA === row.meaning_fa;
      if (!shouldClear) continue;

      if (!dryRun) {
        await prisma.word.update({
          where: { id: row.id },
          data: { meaning_fa_IPA: "" },
          select: { id: true },
        });
      }
      updatedRows += 1;
      process.stdout.write(
        `${dryRun ? "[dryRun] " : ""}clear meaning_fa_IPA for id=${row.id} anki_link_id=${row.anki_link_id}\n`
      );
    }
  }

  process.stdout.write(
    `Done. targets=${scannedTargets} matchedRows=${matchedRows} updatedRows=${updatedRows} dryRun=${dryRun}\n`
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

