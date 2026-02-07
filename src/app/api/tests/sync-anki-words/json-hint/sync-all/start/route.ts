import { NextResponse } from "next/server";

import { startJsonHintSyncAllIfNeeded } from "@/lib/anki/jsonHintSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startJsonHintSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

