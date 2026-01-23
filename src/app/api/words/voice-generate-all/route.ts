import "server-only";

import { NextResponse } from "next/server";

import { getVoiceJobStatus, startVoiceJobIfNeeded } from "@/lib/words/voiceGenerateJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startVoiceJobIfNeeded();
  return NextResponse.json({ ok: true, status });
}

export async function GET() {
  return NextResponse.json({ ok: true, status: getVoiceJobStatus() });
}
