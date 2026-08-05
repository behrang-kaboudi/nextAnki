import { NextResponse } from "next/server";

import { linkUnlinkedWordsToPersianWords } from "@/lib/words/linkUnlinkedWordsToPersianWords.server";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, result: await linkUnlinkedWordsToPersianWords() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not link unlinked Words to PersianWord records." },
      { status: 500 },
    );
  }
}
