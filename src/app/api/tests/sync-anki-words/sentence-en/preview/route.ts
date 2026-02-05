import { NextResponse } from "next/server";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck";
import { WORD_ANKI_FIELD_GENERATORS, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function extractFirstSoundFilename(value: string): string | null {
  const m = /\[sound:(?<fn>[^\]]+)\]/i.exec(value);
  const fn = m?.groups?.fn?.trim();
  return fn ? fn : null;
}

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

  const ankiSentenceEn = note.fields?.sentence_en?.value ?? "";
  const generatedSentenceEn = WORD_ANKI_FIELD_GENERATORS.sentence_en(word);
  const oldMediaFilename = extractFirstSoundFilename(ankiSentenceEn);
  const newMediaFilename = extractFirstSoundFilename(generatedSentenceEn);
  const changed = ankiSentenceEn !== generatedSentenceEn;

  return NextResponse.json(
    {
      ok: true as const,
      modelName,
      noteId,
      ankiLinkId,
      ankiSentenceEn,
      generatedSentenceEn,
      changed,
      oldMediaFilename,
      newMediaFilename,
    },
    { status: 200 },
  );
}
