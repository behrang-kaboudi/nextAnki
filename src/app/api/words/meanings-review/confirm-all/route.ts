import { NextResponse } from "next/server";

import { updateManyWords } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await updateManyWords({
      where: { meanings_confirmed: false },
      data: { meanings_confirmed: true },
    });
    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
