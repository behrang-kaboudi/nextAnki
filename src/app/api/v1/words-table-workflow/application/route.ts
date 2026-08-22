import { NextResponse } from "next/server";

import { getAutomaticWordsTableAgentApplication } from "@/lib/words/wordsTableAgentWorkflow.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ ok: false, error: "A runId is required." }, { status: 400 });
  }
  try {
    return NextResponse.json(
      { ok: true, ...(await getAutomaticWordsTableAgentApplication(runId)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
