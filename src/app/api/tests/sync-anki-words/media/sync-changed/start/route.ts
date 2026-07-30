import { NextResponse } from "next/server";

import { startMediaSyncAllIfNeeded } from "@/lib/anki/mediaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startMediaSyncAllIfNeeded({ mode: "changed" });
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}
