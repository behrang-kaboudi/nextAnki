import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function main() {
  let cursorId = 0;
  let scanned = 0;
  let created = 0;
  let updated = 0;

  while (true) {
    const rows = await prisma.word.findMany({
      where: { id: { gt: cursorId } },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      select: {
        id: true,
        anki_link_id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
      },
    });

    if (!rows.length) break;

    for (const row of rows) {
      scanned += 1;

      const existing = await prisma.sentence.findUnique({
        where: { anki_link_id: row.anki_link_id },
        select: { anki_link_id: true },
      });

      if (existing) {
        await prisma.sentence.update({
          where: { anki_link_id: row.anki_link_id },
          data: {
            sentence_en: row.sentence_en,
            sentence_en_meaning_fa: row.sentence_en_meaning_fa,
          },
        });
        updated += 1;
      } else {
        await prisma.sentence.create({
          data: {
            anki_link_id: row.anki_link_id,
            sentence_en: row.sentence_en,
            sentence_en_meaning_fa: row.sentence_en_meaning_fa,
          },
        });
        created += 1;
      }
    }

    cursorId = rows[rows.length - 1].id;
    process.stdout.write(
      `Processed up to Word.id=${cursorId} scanned=${scanned} created=${created} updated=${updated}\n`
    );
  }

  process.stdout.write(
    `Done. scanned=${scanned} created=${created} updated=${updated}\n`
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
