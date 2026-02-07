import { NextResponse } from "next/server";

import { startAnkiLinkIdDedupIfNeeded } from "@/lib/anki/ankiLinkIdDedupJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startAnkiLinkIdDedupIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

