import { NextResponse } from "next/server";

import { getMeaningFaSyncAllStatus } from "@/lib/anki/meaningFaSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getMeaningFaSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

