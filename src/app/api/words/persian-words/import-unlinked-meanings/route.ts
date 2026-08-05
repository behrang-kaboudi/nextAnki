import { NextResponse } from "next/server";

import { importUnlinkedPersianMeanings } from "@/lib/words/importUnlinkedPersianMeanings.server";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ ok: true, result: await importUnlinkedPersianMeanings() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not import unlinked Persian meanings." },
      { status: 500 },
    );
  }
}
