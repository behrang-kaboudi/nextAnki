import { NextResponse } from "next/server";

import { requestStopSentenceEnSyncAll } from "@/lib/anki/sentenceEnSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopSentenceEnSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

