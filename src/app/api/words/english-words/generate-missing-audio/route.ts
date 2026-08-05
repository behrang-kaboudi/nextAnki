import { NextResponse } from "next/server";

import { getEnglishWordAudioJobStatus, startEnglishWordAudioJobIfNeeded } from "@/lib/english/englishWordAudioGenerateJob";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: true, status: startEnglishWordAudioJobIfNeeded() });
}

export async function GET() {
  return NextResponse.json({ ok: true, status: getEnglishWordAudioJobStatus() });
}
