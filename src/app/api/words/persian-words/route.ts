import { NextResponse } from "next/server";

import {
  PersianWordNormalizationConflictError,
  addPersianWord,
} from "@/lib/tables/persianWord";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
    if (typeof body?.text !== "string") {
      return NextResponse.json({ ok: false, error: "text must be a string." }, { status: 400 });
    }

    const result = await addPersianWord(body.text);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PersianWordNormalizationConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not add PersianWord." },
      { status: 400 }
    );
  }
}
