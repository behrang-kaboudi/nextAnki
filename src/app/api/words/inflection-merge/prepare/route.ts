import "server-only";

import { NextResponse } from "next/server";

import { prepareWordSenseInflectionMerge } from "@/lib/words/wordSenseInflectionMerge.server";
import { parseParallelPromptPartition } from "@/lib/words/parallelPromptPartition";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const partition = parseParallelPromptPartition({
    laneCount: body?.laneCount,
    laneNumber: body?.laneNumber,
    batchSize: body?.batchSize ?? body?.limit,
  }, 50);
  if (!partition) {
    return NextResponse.json({ ok: false, error: "Invalid parallel lane or batch size." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await prepareWordSenseInflectionMerge(partition)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
