import { NextResponse } from "next/server";

import { requestStopAnkiLinkIdDedup } from "@/lib/anki/ankiLinkIdDedupJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopAnkiLinkIdDedup();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

