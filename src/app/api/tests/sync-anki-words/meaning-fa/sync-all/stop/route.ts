import { NextResponse } from "next/server";

import { requestStopMeaningFaSyncAll } from "@/lib/anki/meaningFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopMeaningFaSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

