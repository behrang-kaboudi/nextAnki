import { NextResponse } from "next/server";

/** Legacy backfill endpoint: every WordSense is now required to be linked during creation. */
export async function POST() {
  return NextResponse.json({ ok: false, error: "Legacy linking is no longer available." }, { status: 410 });
}
