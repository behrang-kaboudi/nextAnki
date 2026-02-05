import { NextResponse } from "next/server";

import { requestStopSentenceEnMeaningFaSyncAll } from "@/lib/anki/sentenceEnMeaningFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopSentenceEnMeaningFaSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

