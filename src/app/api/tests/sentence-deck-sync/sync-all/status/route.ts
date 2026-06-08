import { NextResponse } from "next/server";

import { getSentenceDeckSyncAllStatus } from "@/lib/anki/sentenceDeckSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getSentenceDeckSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}
