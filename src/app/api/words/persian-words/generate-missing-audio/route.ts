import { NextResponse } from "next/server";

import { getPersianWordAudioJobStatus, startPersianWordAudioJobIfNeeded } from "@/lib/persian/persianWordAudioGenerateJob";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ ok: true, status: startPersianWordAudioJobIfNeeded() });
}

export async function GET() {
  return NextResponse.json({ ok: true, status: getPersianWordAudioJobStatus() });
}
