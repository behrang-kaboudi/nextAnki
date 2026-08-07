import "server-only";

import { NextResponse } from "next/server";

import { getWordDeletePreview } from "@/lib/words/wordDeletePreview.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = body?.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "A positive Word id is required." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, item: await getWordDeletePreview(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: message === "Word not found." ? 404 : 500 },
    );
  }
}
