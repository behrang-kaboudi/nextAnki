import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const targetTypes = ["tool", "food", "accessory"];

function withSuffix(value, suffix) {
  const base = (value ?? "").toString().trim();
  if (!base) return suffix.trim();
  return `${base} ${suffix.trim()}`;
}

async function main() {
  const rows = await prisma.pictureWord.findMany({
    where: { type: { in: targetTypes } },
    select: {
      id: true,
      fa: true,
      ipa_fa: true,
      ipa_fa_normalized: true,
      phinglish: true,
      en: true,
      type: true,
      usage: true,
      canBePersonal: true,
      canImagineAsHuman: true,
      canUseAsHumanAdj: true,
      ipaVerified: true,
    },
  });

  let created = 0;
  let skipped = 0;

  for (const r of rows) {
    const faNew = withSuffix(r.fa, "فروش");
    const enNew = withSuffix(r.en, "seller");

    const exists = await prisma.pictureWord.findFirst({
      where: { fa: faNew, en: enNew },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await prisma.pictureWord.create({
      data: {
        fa: faNew,
        ipa_fa: withSuffix(r.ipa_fa, "furush"),
        ipa_fa_normalized: withSuffix(r.ipa_fa_normalized, "furush"),
        phinglish: withSuffix(r.phinglish, "furush"),
        en: enNew,
        type: r.type,
        usage: "Job",
        canBePersonal: r.canBePersonal,
        canImagineAsHuman: r.canImagineAsHuman,
        canUseAsHumanAdj: r.canUseAsHumanAdj,
        ipaVerified: true,
      },
    });
    created += 1;
  }

  console.log(JSON.stringify({ targetTypes, scanned: rows.length, created, skipped }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

