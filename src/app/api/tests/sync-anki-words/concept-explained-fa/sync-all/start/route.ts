import { NextResponse } from "next/server";

import { startConceptExplainedFaSyncAllIfNeeded } from "@/lib/anki/conceptExplainedFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startConceptExplainedFaSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

