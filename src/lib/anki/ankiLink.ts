import "server-only";

import { prisma } from "@/lib/prisma";
import { createAnkiConnectClient, type AnkiNotesInfo } from "@/lib/AnkiConnect";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

export function getAnkiLinkIdFromNoteFields(note: AnkiNotesInfo[number]): string | null {
  const a = asNonEmptyString(note.fields?.anki_link_id?.value);
  if (a) return a;
  const b = asNonEmptyString(note.fields?.AnkiLinkId?.value);
  if (b) return b;
  const c = asNonEmptyString(note.fields?.ankiLinkId?.value);
  if (c) return c;
  return null;
}

export async function getAnkiNoteAndDbWordByAnkiLinkId(noteId: number) {
  const anki = createAnkiConnectClient();
  const noteInfoRes = await anki.requestDetailed("notesInfo", { notes: [noteId] });
  if (!noteInfoRes.ok) return { ok: false as const, error: noteInfoRes.error };
  const note = noteInfoRes.result?.[0];
  if (!note) return { ok: false as const, error: "Anki note not found (notesInfo)" };

  const ankiLinkId = getAnkiLinkIdFromNoteFields(note);
  if (!ankiLinkId) return { ok: false as const, error: "anki_link_id not found on Anki note fields" };

  const word = await prisma.word.findUnique({
    where: { anki_link_id: ankiLinkId },
    select: { id: true, anki_link_id: true, hint_sentence: true },
  });
  if (!word) return { ok: false as const, error: `DB word not found for anki_link_id=${ankiLinkId}` };

  return { ok: true as const, note, word };
}

