import { NextResponse } from "next/server";

import { getPendingWordsTableAgentResponse, WORDS_TABLE_AGENT_STAGE_IDS, type WordsTableAgentStageId } from "@/lib/words/wordsTableAgentWorkflow.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const stageId = params.get("stageId");
  if (!stageId || !WORDS_TABLE_AGENT_STAGE_IDS.includes(stageId as WordsTableAgentStageId)) {
    return NextResponse.json({ ok: false, error: "A valid stageId is required." }, { status: 400 });
  }
  try {
    const artifact = await getPendingWordsTableAgentResponse(
      stageId as WordsTableAgentStageId,
      params.get("includeResponse") === "1",
    );
    return NextResponse.json({ ok: true, artifact }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
