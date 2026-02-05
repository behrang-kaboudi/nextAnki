import { NextResponse } from "next/server";

import { startSentenceEnMeaningFaSyncAllIfNeeded } from "@/lib/anki/sentenceEnMeaningFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startSentenceEnMeaningFaSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

