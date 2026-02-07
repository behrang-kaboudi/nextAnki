import { NextResponse } from "next/server";

import { getJsonHintSyncAllStatus } from "@/lib/anki/jsonHintSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getJsonHintSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

