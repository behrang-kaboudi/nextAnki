import { NextResponse } from "next/server";

import { startOtherMeaningsFaSyncAllIfNeeded } from "@/lib/anki/otherMeaningsFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = startOtherMeaningsFaSyncAllIfNeeded();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

