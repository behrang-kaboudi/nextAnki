import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { updateWord } from "@/lib/words/wordRepo";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const words = await prisma.word.findMany({
      where: {
        sentenceId: null,
        sentenceLinks: { some: { isPrimary: true } },
      },
      select: {
        id: true,
        sentenceLinks: {
          where: { isPrimary: true },
          orderBy: { sentenceId: "asc" },
          take: 1,
          select: { sentenceId: true },
        },
      },
      orderBy: { id: "asc" },
    });

    let updated = 0;
    const batchSize = 25;
    for (let offset = 0; offset < words.length; offset += batchSize) {
      const batch = words.slice(offset, offset + batchSize);
      const results = await Promise.all(
        batch.map((word) => {
          const sentenceId = word.sentenceLinks[0]?.sentenceId;
          if (!sentenceId) return null;
          return updateWord({
            where: { id: word.id },
            data: { sentenceId },
            select: { id: true },
          });
        }),
      );
      updated += results.filter(Boolean).length;
    }

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
