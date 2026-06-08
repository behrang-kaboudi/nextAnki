import { NextResponse } from "next/server";

import { requestStopSentenceDeckSyncAll } from "@/lib/anki/sentenceDeckSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopSentenceDeckSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}
