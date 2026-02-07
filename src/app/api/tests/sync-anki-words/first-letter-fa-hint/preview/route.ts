import { NextResponse } from "next/server";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck";
import { WORD_ANKI_FIELD_GENERATORS, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  const anki = createAnkiConnectClient({ timeoutMs: 15_000, retryDelayMs: 750 });

  const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
  const query = `note:"${modelName}"`;

  const found = await anki.requestDetailed("findNotes", { query });
  if (!found.ok) {
    return NextResponse.json({ ok: false as const, error: found.error }, { status: 502 });
  }

  const noteIds = found.result ?? [];
  const noteId = noteIds[0];
  if (!noteId) {
    return NextResponse.json(
      { ok: false as const, error: `No notes found for note type: ${modelName}` },
      { status: 404 },
    );
  }

  const info = await anki.requestDetailed("notesInfo", { notes: [noteId] });
  if (!info.ok) {
    return NextResponse.json({ ok: false as const, error: info.error }, { status: 502 });
  }

  const note = info.result?.[0];
  if (!note) {
    return NextResponse.json(
      { ok: false as const, error: "notesInfo returned empty result" },
      { status: 502 },
    );
  }

  const ankiLinkId = getAnkiLinkIdFromNoteFields(note);
  if (!ankiLinkId) {
    return NextResponse.json(
      { ok: false as const, error: "anki_link_id not found on the Anki note" },
      { status: 422 },
    );
  }

  const word = await prisma.word.findUnique({ where: { anki_link_id: ankiLinkId } });
  if (!word) {
    return NextResponse.json(
      { ok: false as const, error: `DB word not found for anki_link_id=${ankiLinkId}` },
      { status: 404 },
    );
  }

  const ankiValue = note.fields?.first_letter_fa_hint?.value ?? "";
  const generatedValue = await WORD_ANKI_FIELD_GENERATORS.first_letter_fa_hint(word);
  const changed = ankiValue !== generatedValue;

  return NextResponse.json(
    {
      ok: true as const,
      modelName,
      noteId,
      ankiLinkId,
      ankiValue,
      generatedValue,
      changed,
    },
    { status: 200 },
  );
}
