import { NextResponse } from "next/server";

import { getSentenceEnSyncAllStatus } from "@/lib/anki/sentenceEnSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getSentenceEnSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

