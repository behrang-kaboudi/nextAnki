import { NextResponse } from "next/server";

import { getWordsTableWorkflowStatus, WORDS_TABLE_HUMAN_REVIEW_POLICIES, type WordsTableHumanReviewPolicy } from "@/lib/words/wordsTableAgentWorkflow.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get("humanReviewPolicy");
  const humanReviewPolicy = WORDS_TABLE_HUMAN_REVIEW_POLICIES.includes(value as WordsTableHumanReviewPolicy)
    ? value as WordsTableHumanReviewPolicy
    : undefined;
  try {
    return NextResponse.json({ ok: true, ...(await getWordsTableWorkflowStatus(humanReviewPolicy)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
