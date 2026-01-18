import { NextResponse } from "next/server";

import { gptChat } from "@/lib/ai/model_runner/gpt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const systemPrompt = typeof obj?.systemPrompt === "string" ? obj.systemPrompt : "";
  const userText = typeof obj?.userText === "string" ? obj.userText : "";

  if (!systemPrompt.trim()) {
    return NextResponse.json({ error: "`systemPrompt` is required" }, { status: 400 });
  }
  if (!userText.trim()) {
    return NextResponse.json({ error: "`userText` is required" }, { status: 400 });
  }

  try {
    const output = await gptChat({
      systemPrompt,
      itemString: userText,
      cacheRetention: "in_memory",
    });
    return NextResponse.json({ ok: true, output });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
