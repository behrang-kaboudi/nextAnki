import { NextResponse } from "next/server";

import { loadMeaningReviewPromptRecords } from "@/lib/words/meaningReviewWorkflow.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
  } | null;
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (
    !ids.length ||
    ids.some(
      (id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
    ) ||
    new Set(ids).size !== ids.length
  )
    return NextResponse.json(
      { ok: false, error: "ids must be positive integers." },
      { status: 400 },
    );
  const records = await loadMeaningReviewPromptRecords({ ids });
  if (records.length !== ids.length) {
    return NextResponse.json(
      { ok: false, error: "One or more response ids no longer exist." },
      { status: 400 },
    );
  }
  const recordById = new Map(records.map((record) => [record.id, record]));
  return NextResponse.json({
    ok: true,
    items: ids.map((id) => recordById.get(id)!),
  });
}
