import { NextResponse } from "next/server";

import { getConceptExplainedFaSyncAllStatus } from "@/lib/anki/conceptExplainedFaSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getConceptExplainedFaSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

