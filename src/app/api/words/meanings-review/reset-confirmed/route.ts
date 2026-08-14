import { NextResponse } from "next/server";
import { MeaningReviewStatus } from "@prisma/client";
import { updateManyWordSenses } from "@/lib/words/wordSenseRepo";
export const runtime = "nodejs";
export async function POST() {
  const result = await updateManyWordSenses({
    where: { meaningReviewStatus: MeaningReviewStatus.CONFIRMED },
    data: { meaningReviewStatus: MeaningReviewStatus.PENDING },
  });
  return NextResponse.json({ ok: true, reset: result.count });
}
