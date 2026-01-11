import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXCEPTIONS = [
  { id: 522, fa: "اسکیمو" },
  { id: 582, fa: "عروس" },
  { id: 596, fa: "امپراتور" },
  { id: 720, fa: "شهردار" },
  { id: 1122, fa: "زن" },
  { id: 1186, fa: "ژنرال" },
  { id: 1261, fa: "آلپاچینو" },
  { id: 1287, fa: "ایوانکا" },
  { id: 1302, fa: "مادربزرگ" },
  { id: 1321, fa: "اسقف" },
];

async function main() {
  const ids = EXCEPTIONS.map((x) => x.id);

  const mismatches = [];
  for (const ex of EXCEPTIONS) {
    const row = await prisma.pictureWord.findUnique({
      where: { id: ex.id },
      select: { id: true, fa: true, type: true },
    });
    if (!row) continue;
    if (row.fa !== ex.fa) mismatches.push({ id: ex.id, expectedFa: ex.fa, actualFa: row.fa });
  }
  if (mismatches.length) {
    process.stderr.write(`Warning: exception fa mismatch:\n${JSON.stringify(mismatches, null, 2)}\n`);
  }

  const res = await prisma.pictureWord.updateMany({
    where: {
      type: "person",
      NOT: { id: { in: ids } },
    },
    data: { type: "occupation" },
  });

  process.stdout.write(`Updated ${res.count} row(s) from type=person to type=occupation\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

