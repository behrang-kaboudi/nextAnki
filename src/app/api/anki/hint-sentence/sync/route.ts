import "server-only";

import { NextResponse } from "next/server";

import { syncHintSentenceForAnkiNote } from "@/lib/anki/hintSentenceSync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const noteIdRaw = (body as { noteId?: unknown } | null)?.noteId;
  const noteId = Number(noteIdRaw);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid noteId" }, { status: 400 });
  }

  const res = await syncHintSentenceForAnkiNote(Math.trunc(noteId));
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, note: res.note });
}

