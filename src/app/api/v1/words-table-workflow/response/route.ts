import { NextResponse } from "next/server";

import { saveWordsTableAgentResponse } from "@/lib/words/wordsTableAgentWorkflow.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.runId !== "string" || !("response" in body) || !("qa" in body)) {
    return NextResponse.json({ ok: false, error: "Body must include runId, response, and qa." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await saveWordsTableAgentResponse({ runId: body.runId, response: body.response, qa: body.qa })) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
