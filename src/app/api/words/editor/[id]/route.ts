import "server-only";

import { NextResponse } from "next/server";

import { getWordEditorInitial } from "@/lib/words/editorPayload";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id: idRaw } = await params;
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid word id." }, { status: 400 });
    }

    const item = await getWordEditorInitial(Math.floor(id));
    if (!item) {
      return NextResponse.json({ ok: false, error: `WordSense ${id} not found.` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
