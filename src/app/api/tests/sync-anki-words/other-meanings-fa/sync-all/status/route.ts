import { NextResponse } from "next/server";

import { getOtherMeaningsFaSyncAllStatus } from "@/lib/anki/otherMeaningsFaSyncAllJob";

export const runtime = "nodejs";

export async function GET() {
  const status = getOtherMeaningsFaSyncAllStatus();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

