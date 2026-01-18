import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_TYPES = ["food", "accessory", "tool", "noun"];

async function main() {
  const result = await prisma.pictureWord.updateMany({
    where: { type: { in: TARGET_TYPES } },
    data: { canBePersonal: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        updatedCount: result.count,
        types: TARGET_TYPES,
      },
      null,
      2
    )
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

