import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const targetTypes = ["adj", "personAdj_adj", "personAdj"];

  const before = await prisma.pictureWord.count({
    where: { type: { in: targetTypes } },
  });

  const res = await prisma.pictureWord.updateMany({
    where: { type: { in: targetTypes } },
    data: { usage: "adj" },
  });

  const after = await prisma.pictureWord.count({
    where: { type: { in: targetTypes }, usage: "adj" },
  });

  console.log(
    JSON.stringify(
      { targetTypes, matchedBefore: before, updated: res.count, matchedAfter: after },
      null,
      2,
    ),
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

