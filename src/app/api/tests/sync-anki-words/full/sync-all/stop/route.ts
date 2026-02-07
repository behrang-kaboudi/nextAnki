import { NextResponse } from "next/server";

import { requestStopFullSyncAll } from "@/lib/anki/fullSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopFullSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

