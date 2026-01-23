import "server-only";

import { NextResponse } from "next/server";

import {
  getHintSentenceSyncAllStatus,
  requestStopHintSentenceSyncAll,
  startHintSentenceSyncAllIfNeeded,
} from "@/lib/anki/hintSentenceSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startHintSentenceSyncAllIfNeeded();
  return NextResponse.json({ ok: true, status });
}

export async function GET() {
  return NextResponse.json({ ok: true, status: getHintSentenceSyncAllStatus() });
}

export async function DELETE() {
  return NextResponse.json({ ok: true, status: requestStopHintSentenceSyncAll() });
}
