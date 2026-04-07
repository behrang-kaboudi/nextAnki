import { NextResponse } from "next/server";

import { ensureEnSentesesAnkiSetup } from "@/lib/anki/ensureEnSentesesAnkiSetup";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await ensureEnSentesesAnkiSetup();
    return NextResponse.json({ ok: true as const, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
