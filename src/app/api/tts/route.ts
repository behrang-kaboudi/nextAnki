import "server-only";

import { NextResponse } from "next/server";

import { generateSpeechFromMixedText } from "@/lib/tts/cloudTts";

type Provider = "azure" | "openai" | "polly";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { text?: string; provider?: Provider; filename?: string }
      | null;

    const text = String(body?.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

    const provider = (body?.provider ?? "azure") as Provider;
    const filename = String(body?.filename ?? "").trim() || `tts_${Date.now()}.mp3`;

    const savedPath = await generateSpeechFromMixedText(text, filename, provider);
    return NextResponse.json({
      ok: true,
      provider,
      filename,
      publicPath: `/audio/${filename}`,
      savedPath,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

