import { NextResponse } from "next/server";

/** Legacy import endpoint kept only to return an explicit migration message. */
export async function POST() {
  return NextResponse.json({ ok: false, error: "Legacy Persian-meaning import is no longer available." }, { status: 410 });
}
