import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const targetTypes = ["noun", "accessory", "tool", "food", "animal", "person"];

async function main() {
  const before = await prisma.pictureWord.count({
    where: { type: { in: targetTypes } },
  });

  const res = await prisma.pictureWord.updateMany({
    where: { type: { in: targetTypes } },
    data: { usage: "person" },
  });

  const after = await prisma.pictureWord.count({
    where: { type: { in: targetTypes }, usage: "person" },
  });


}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

