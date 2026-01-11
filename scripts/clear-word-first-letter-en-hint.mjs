import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.word.updateMany({
    data: { first_letter_en_hint: null },
  });
  process.stdout.write(`Cleared Word.first_letter_en_hint for ${result.count} row(s)\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

