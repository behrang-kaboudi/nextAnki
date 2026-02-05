import { NextResponse } from "next/server";

import { getSentenceEnMeaningFaSyncAllStatus } from "@/lib/anki/sentenceEnMeaningFaSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getSentenceEnMeaningFaSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

