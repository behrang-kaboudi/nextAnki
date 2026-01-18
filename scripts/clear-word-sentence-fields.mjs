import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.word.updateMany({
    data: {
      sentence_en: "",
      sentence_en_meaning_fa: null,
      mixed_sentence: null,
    },
  });

  process.stdout.write(
    `Cleared fields for ${result.count} Word rows (sentence_en="", sentence_en_meaning_fa=NULL, mixed_sentence=NULL)\n`
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

