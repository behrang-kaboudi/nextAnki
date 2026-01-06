import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

function normalizeSpaces(input) {
  if (!input) return "";
  return input.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
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
      const nextFa = normalizeSpaces(row.fa);
      const nextFaPlain = normalizeSpaces(row.faPlain);

      if (row.fa === nextFa && row.faPlain === nextFaPlain) continue;

      await prisma.ipaKeyword.update({
        where: { id: row.id },
        data: { fa: nextFa, faPlain: nextFaPlain },
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

