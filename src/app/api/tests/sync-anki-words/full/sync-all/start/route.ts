import { NextResponse } from "next/server";

import { startFullSyncAllIfNeeded } from "@/lib/anki/fullSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startFullSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

