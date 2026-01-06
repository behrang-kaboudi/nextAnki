import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

function stripArabicDiacritics(input) {
  if (!input) return "";
  return input
    .normalize("NFC")
    .replace(/[\u0640\u0670]/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/[\u06D6-\u06ED]/g, "")
    .trim();
}

async function main() {
  const batchSize = Number(process.env.BATCH_SIZE || 500);
  let lastId = 0;
  let updated = 0;

  for (;;) {
    const rows = await prisma.ipaKeyword.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: "asc" },
      take: batchSize,
      select: { id: true, fa: true, faPlain: true },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      lastId = row.id;
      const nextPlain = stripArabicDiacritics(row.fa);
      if (row.faPlain === nextPlain) continue;

      await prisma.ipaKeyword.update({
        where: { id: row.id },
        data: { faPlain: nextPlain },
      });
      updated += 1;
    }

    console.log(`Processed up to id=${lastId}. Updated=${updated}`);
  }

  console.log(`Done. Updated rows: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

