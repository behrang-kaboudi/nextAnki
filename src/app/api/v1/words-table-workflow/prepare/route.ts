import { NextResponse } from "next/server";

import { prepareNextWordsTableAgentStage, WORDS_TABLE_HUMAN_REVIEW_POLICIES, type WordsTableHumanReviewPolicy } from "@/lib/words/wordsTableAgentWorkflow.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const humanReviewPolicy = body?.humanReviewPolicy;
  if (!WORDS_TABLE_HUMAN_REVIEW_POLICIES.includes(humanReviewPolicy as WordsTableHumanReviewPolicy)) {
    return NextResponse.json({ ok: false, error: "Body must include humanReviewPolicy as merge_only or all_stages." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await prepareNextWordsTableAgentStage(humanReviewPolicy as WordsTableHumanReviewPolicy)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
