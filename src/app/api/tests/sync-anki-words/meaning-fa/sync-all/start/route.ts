import { NextResponse } from "next/server";

import { startMeaningFaSyncAllIfNeeded } from "@/lib/anki/meaningFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startMeaningFaSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

