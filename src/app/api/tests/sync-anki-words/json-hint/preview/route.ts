import { NextResponse } from "next/server";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { AnkiNoteTypes } from "@/lib/AnkiDeck";
import { WORD_ANKI_FIELD_GENERATORS, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const ankiLinkIdOverride =
    body && typeof body === "object" && "ankiLinkId" in body
      ? String((body as { ankiLinkId?: unknown }).ankiLinkId ?? "").trim()
      : "";

  if (ankiLinkIdOverride) {
    const word = await prisma.word.findUnique({ where: { anki_link_id: ankiLinkIdOverride } });
    if (!word) {
      return NextResponse.json(
        { ok: false as const, error: `DB word not found for anki_link_id=${ankiLinkIdOverride}` },
        { status: 404 },
      );
    }

    const generatedJsonHint = await WORD_ANKI_FIELD_GENERATORS.json_hint(word);
    const generatedFirstLetterFaHint = await WORD_ANKI_FIELD_GENERATORS.first_letter_fa_hint(word);
    const generatedFirstLetterEnHint = await WORD_ANKI_FIELD_GENERATORS.first_letter_en_hint(word);

    return NextResponse.json(
      {
        ok: true as const,
        modelName: null,
        noteId: null,
        ankiLinkId: ankiLinkIdOverride,
        ankiJsonHint: null,
        generatedJsonHint,
        jsonHintChanged: null,
        ankiFirstLetterFaHint: null,
        generatedFirstLetterFaHint,
        firstLetterFaHintChanged: null,
        ankiFirstLetterEnHint: null,
        generatedFirstLetterEnHint,
        firstLetterEnHintChanged: null,
      },
      { status: 200 },
    );
  }

  const anki = createAnkiConnectClient({ timeoutMs: 15_000, retryDelayMs: 750 });

  const modelName = AnkiNoteTypes.META_LEX_VR9;
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

  const ankiJsonHint = note.fields?.json_hint?.value ?? "";
  const generatedJsonHint = await WORD_ANKI_FIELD_GENERATORS.json_hint(word);
  const jsonHintChanged = ankiJsonHint !== generatedJsonHint;

  const ankiFirstLetterFaHint = note.fields?.first_letter_fa_hint?.value ?? "";
  const generatedFirstLetterFaHint = await WORD_ANKI_FIELD_GENERATORS.first_letter_fa_hint(word);
  const firstLetterFaHintChanged = ankiFirstLetterFaHint !== generatedFirstLetterFaHint;

  const ankiFirstLetterEnHint = note.fields?.first_letter_en_hint?.value ?? "";
  const generatedFirstLetterEnHint = await WORD_ANKI_FIELD_GENERATORS.first_letter_en_hint(word);
  const firstLetterEnHintChanged = ankiFirstLetterEnHint !== generatedFirstLetterEnHint;

  return NextResponse.json(
    {
      ok: true as const,
      modelName,
      noteId,
      ankiLinkId,
      ankiJsonHint,
      generatedJsonHint,
      jsonHintChanged,
      ankiFirstLetterFaHint,
      generatedFirstLetterFaHint,
      firstLetterFaHintChanged,
      ankiFirstLetterEnHint,
      generatedFirstLetterEnHint,
      firstLetterEnHintChanged,
    },
    { status: 200 },
  );
}
