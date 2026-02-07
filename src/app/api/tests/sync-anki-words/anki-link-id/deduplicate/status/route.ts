import { NextResponse } from "next/server";

import { getAnkiLinkIdDedupStatus } from "@/lib/anki/ankiLinkIdDedupJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getAnkiLinkIdDedupStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

