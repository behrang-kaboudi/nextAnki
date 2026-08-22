import { NextResponse } from "next/server";

import { completeWordsTableAgentRun } from "@/lib/words/wordsTableAgentWorkflow.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.runId !== "string") {
    return NextResponse.json({ ok: false, error: "Body must include runId." }, { status: 400 });
  }
  try {
    const manifest = await completeWordsTableAgentRun(body.runId);
    return NextResponse.json({ ok: true, runId: manifest.runId, stageId: manifest.stageId, status: manifest.status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
