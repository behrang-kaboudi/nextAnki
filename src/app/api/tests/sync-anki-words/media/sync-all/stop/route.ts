import { NextResponse } from "next/server";

import { requestStopMediaSyncAll } from "@/lib/anki/mediaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopMediaSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

