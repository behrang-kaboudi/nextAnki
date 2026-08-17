import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parsePromptBatchSize, selectPromptBatch } from "@/lib/words/promptBatch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const batchSize = parsePromptBatchSize(
    Number(params.get("batchSize") ?? params.get("limit") ?? "100"),
    100,
  );
  if (batchSize === null) {
    return NextResponse.json({ ok: false, error: "Invalid batch size." }, { status: 400 });
  }
  const where = { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] };
  const [totalMissing, eligible] = await Promise.all([
    prisma.persianWord.count({ where }),
    prisma.persianWord.findMany({
      where,
      orderBy: { id: "asc" },
      select: { id: true, canonical_text: true },
    }),
  ]);
  const items = selectPromptBatch(eligible, batchSize);
  return NextResponse.json({ ok: true, totalMissing, items });
}
