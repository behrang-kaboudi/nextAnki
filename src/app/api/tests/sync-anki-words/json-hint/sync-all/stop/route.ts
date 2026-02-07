import { NextResponse } from "next/server";

import { requestStopJsonHintSyncAll } from "@/lib/anki/jsonHintSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopJsonHintSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

