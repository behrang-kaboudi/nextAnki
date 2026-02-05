import { NextResponse } from "next/server";

import { requestStopOtherMeaningsFaSyncAll } from "@/lib/anki/otherMeaningsFaSyncAllJob";

export const runtime = "nodejs";

export async function POST() {
  const status = requestStopOtherMeaningsFaSyncAll();
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

