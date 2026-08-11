import "server-only";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { prisma } from "@/lib/prisma";

/**
 * Finds canonical EnglishWord ids whose base form or confirmed alternate form
 * matches an incoming spelling. Multiple ids are valid for ambiguous spellings.
 */
export async function findEnglishWordIdsByKnownForm(value: string) {
  const form = normalizeEnglishWordText(value);
  if (!form) return [];
  const rows = await prisma.englishWord.findMany({
    where: {
      OR: [
        { base_form: form },
        { forms: { some: { form } } },
      ],
    },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
