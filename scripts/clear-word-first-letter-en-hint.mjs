import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const res = await prisma.word.updateMany({
    data: { first_letter_en_hint: null },
  });
  console.log(`Cleared first_letter_en_hint for ${res.count} rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

