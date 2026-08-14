import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parseParallelPromptPartition, selectParallelPromptLane } from "@/lib/words/parallelPromptPartition";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const partition = parseParallelPromptPartition({
    laneCount: Number(params.get("laneCount") ?? "1"),
    laneNumber: Number(params.get("laneNumber") ?? "1"),
    batchSize: Number(params.get("batchSize") ?? params.get("limit") ?? "100"),
  }, 100);
  if (!partition) {
    return NextResponse.json({ ok: false, error: "Invalid parallel lane or batch size." }, { status: 400 });
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
  const { items, laneEligibleCount } = selectParallelPromptLane(eligible, (item) => item.id, partition);
  return NextResponse.json({ ok: true, totalMissing, laneEligibleCount, items });
}
