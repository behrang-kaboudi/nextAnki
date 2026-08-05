import { NextResponse } from "next/server";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { prisma } from "@/lib/prisma";
import { updateManyWords } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

export async function POST() {
  try {
    const [words, englishWords] = await Promise.all([
      prisma.word.findMany({ select: { id: true, base_form: true } }),
      prisma.englishWord.findMany({ select: { id: true, base_form: true } }),
    ]);
    const englishIdByText = new Map(englishWords.map((word) => [word.base_form, word.id]));
    const wordIdsByEnglishId = new Map<number, number[]>();
    let skippedInvalidWordRows = 0;

    for (const word of words) {
      const normalizedText = normalizeEnglishWordText(word.base_form);
      if (!normalizedText) {
        skippedInvalidWordRows += 1;
        continue;
      }
      const englishId = englishIdByText.get(normalizedText);
      if (!englishId) continue;
      const wordIds = wordIdsByEnglishId.get(englishId) ?? [];
      wordIds.push(word.id);
      wordIdsByEnglishId.set(englishId, wordIds);
    }

    const updates = await Promise.all(
      [...wordIdsByEnglishId].map(([englishId, ids]) => updateManyWords({
        where: { id: { in: ids } },
        data: { englishId },
      })),
    );
    const matchedWordRows = [...wordIdsByEnglishId.values()].reduce((total, ids) => total + ids.length, 0);
    const updatedWordRows = updates.reduce((total, result) => total + result.count, 0);

    return NextResponse.json({
      ok: true,
      report: {
        scannedWordRows: words.length,
        matchedWordRows,
        updatedWordRows,
        unmatchedWordRows: words.length - matchedWordRows - skippedInvalidWordRows,
        skippedInvalidWordRows,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not link Word rows to EnglishWord rows." }, { status: 500 });
  }
}
