import { NextResponse } from "next/server";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  try {
    const words = await prisma.word.findMany({ select: { id: true, base_form: true } });
    const normalizedTexts = new Set<string>();
    const skipped: Array<{ id: number; base_form: string }> = [];
    let validWordRows = 0;

    for (const word of words) {
      const normalizedText = normalizeEnglishWordText(word.base_form);
      if (!normalizedText) {
        if (skipped.length < 20) skipped.push({ id: word.id, base_form: word.base_form });
        continue;
      }
      validWordRows += 1;
      normalizedTexts.add(normalizedText);
    }

    const normalizedTextValues = [...normalizedTexts];
    const existing = await prisma.englishWord.findMany({
      where: { base_form: { in: normalizedTextValues } },
      select: { id: true, base_form: true },
    });
    const existingByText = new Map(existing.map((item) => [item.base_form, item.id]));
    const missingTexts = normalizedTextValues.filter((text) => !existingByText.has(text));
    if (missingTexts.length) {
      await prisma.englishWord.createMany({ data: missingTexts.map((base_form) => ({ base_form })), skipDuplicates: true });
    }
    return NextResponse.json({
      ok: true,
      report: {
        scannedWordRows: words.length,
        normalizedUniqueTexts: normalizedTextValues.length,
        createdEnglishWords: missingTexts.length,
        alreadyExistingEnglishWords: existing.length,
        skippedInvalidWordRows: words.length - validWordRows,
        skippedExamples: skipped,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not import Word.base_form values." }, { status: 500 });
  }
}
