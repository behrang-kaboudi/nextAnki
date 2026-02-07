import { NextResponse } from "next/server";

import { getFullSyncAllStatus } from "@/lib/anki/fullSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getFullSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

