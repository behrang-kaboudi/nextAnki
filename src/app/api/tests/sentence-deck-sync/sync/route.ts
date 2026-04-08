import { NextResponse } from "next/server";

import { syncSentencesToSentenceDeck } from "@/lib/anki/sentenceDeckSync";

export const runtime = "nodejs";

export async function POST() {
  const result = await syncSentencesToSentenceDeck();
  const status = result.ok ? 200 : 500;
  return NextResponse.json(result, { status });
}
