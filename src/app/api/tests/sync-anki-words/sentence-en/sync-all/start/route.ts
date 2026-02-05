import { NextResponse } from "next/server";

import { startSentenceEnSyncAllIfNeeded } from "@/lib/anki/sentenceEnSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startSentenceEnSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

