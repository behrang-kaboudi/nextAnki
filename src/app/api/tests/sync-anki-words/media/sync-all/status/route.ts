import { NextResponse } from "next/server";

import { getMediaSyncAllStatus } from "@/lib/anki/mediaSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getMediaSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

