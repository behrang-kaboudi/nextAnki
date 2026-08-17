import { MeaningReviewStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import { NEEDS_ACTION_MEANING_REVIEW_STATUSES } from "@/lib/words/meaningReviewStatus";
import { updateWordSense } from "@/lib/words/wordSenseRepo";

export const runtime = "nodejs";

type Body = { id?: unknown; action?: unknown; meaning_fa?: unknown };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null;
  const id = body?.id;
  const action = body?.action;
  const meaningFa = typeof body?.meaning_fa === "string" ? body.meaning_fa.trim() : "";
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 ||
      !["confirm_current", "replace_primary"].includes(String(action))) {
    return NextResponse.json({ ok: false, error: "A valid id and resolution action are required." }, { status: 400 });
  }
  if (action === "replace_primary" && !meaningFa) {
    return NextResponse.json({ ok: false, error: "meaning_fa is required when replacing the primary meaning." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.wordSense.findUnique({
        where: { id },
        select: { id: true, meaningId: true, meaningReviewStatus: true },
      });
      if (!current) throw new Error(`WordSense ${id} no longer exists.`);
      if (!(NEEDS_ACTION_MEANING_REVIEW_STATUSES as readonly MeaningReviewStatus[]).includes(current.meaningReviewStatus)) {
        throw new Error(`WordSense ${id} is no longer waiting for human action.`);
      }
      let meaningId = current.meaningId;
      if (action === "replace_primary") {
        meaningId = (await addPersianWordWithClient(meaningFa, {}, tx)).item.id;
      }
      if (!meaningId) throw new Error("A missing primary meaning must be entered before confirmation.");
      return updateWordSense({
        where: { id },
        data: {
          meaningId,
          meaningReviewStatus: MeaningReviewStatus.CONFIRMED,
          conceptMergeReviewed: false,
        },
        select: { id: true, meaningReviewStatus: true, meaning: { select: { canonical_text: true } } },
      }, tx);
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ ok: true, item: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
