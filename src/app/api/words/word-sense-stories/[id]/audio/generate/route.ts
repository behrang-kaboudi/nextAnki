import { NextResponse } from "next/server";

import { generateWordSenseStoryAudio } from "@/lib/words/wordSenseStoryAudio.server";

export const runtime = "nodejs";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid WordSenseStory id." }, { status: 400 });
  try {
    const result = await generateWordSenseStoryAudio(id);
    return NextResponse.json({ ok: true, filename: result.filename });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not generate story audio." }, { status: 500 });
  }
}
