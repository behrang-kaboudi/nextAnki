import { NextResponse } from "next/server";

import { requestStopConceptExplainedFaSyncAll } from "@/lib/anki/conceptExplainedFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopConceptExplainedFaSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

