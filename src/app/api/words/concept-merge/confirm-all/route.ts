import { NextResponse } from "next/server";

import { updateManyWordSenses } from "@/lib/words/wordSenseRepo";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await updateManyWordSenses({
      where: { conceptMergeReviewed: false },
      data: { conceptMergeReviewed: true },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
