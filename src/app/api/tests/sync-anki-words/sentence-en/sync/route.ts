import { NextResponse } from "next/server";

import fs from "node:fs";
import path from "node:path";

import { createAnkiOperations } from "@/lib/anki";
import { AnkiNoteTypes } from "@/lib/anki";
import { WORD_ANKI_FIELD_GENERATORS, getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";
import { prisma } from "@/lib/prisma";
import { hydrateWordWithEnglishFields } from "@/lib/english/wordEnglishFields.server";

export const runtime = "nodejs";

function extractFirstSoundFilename(value: string): string | null {
  const m = /\[sound:(?<fn>[^\]]+)\]/i.exec(value);
  const fn = m?.groups?.fn?.trim();
  return fn ? fn : null;
}

async function uploadWordFieldAudioToAnki(filename: string, anki: ReturnType<typeof createAnkiOperations>) {
  const root = path.join(process.cwd(), "public", "audio");
  const stack = [root];
  let absPath: string | null = null;
  while (stack.length && !absPath) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.name || entry.name.startsWith(".")) continue;
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(candidate);
      else if (entry.isFile() && entry.name === filename) {
        absPath = candidate;
        break;
      }
    }
  }
  if (!absPath) return { ok: false as const, error: `Local audio not found: ${filename}` };
  if (fs.statSync(absPath).size <= 0) return { ok: false as const, error: `Local audio is zero-byte: ${filename}` };

  const bytes = fs.readFileSync(absPath);
  const data = bytes.toString("base64");
  const res = await anki.storeMediaFile({ filename, data, deleteExisting: true });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
}

async function deleteMediaIfExists(filename: string, anki: ReturnType<typeof createAnkiOperations>) {
  const res = await anki.deleteMediaFile({ filename });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
}

export async function POST() {
  const anki = createAnkiOperations({ timeoutMs: 15_000, retryDelayMs: 750 });

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  const query = `note:"${modelName}"`;

  const found = await anki.findNotes({ query });
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

  const info = await anki.notesInfo({ notes: [noteId] });
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

  const rawWord = await prisma.word.findUnique({ where: { anki_link_id: ankiLinkId } });
  if (!rawWord) {
    return NextResponse.json(
      { ok: false as const, error: `DB word not found for anki_link_id=${ankiLinkId}` },
      { status: 404 },
    );
  }
  const word = await hydrateWordWithEnglishFields(rawWord);

  const oldValue = note.fields?.sentence_en?.value ?? "";
  const newValue = await WORD_ANKI_FIELD_GENERATORS.sentence_en(word);

  if (oldValue === newValue) {
    return NextResponse.json(
      {
        ok: true as const,
        changed: false,
        modelName,
        noteId,
        ankiLinkId,
        oldValue,
        newValue,
      },
      { status: 200 },
    );
  }

  const oldFilename = extractFirstSoundFilename(oldValue);
  const newFilename = extractFirstSoundFilename(newValue);

  const media: Array<{ step: string; ok: boolean; filename?: string; error?: string }> = [];

  // Replace/ensure the new file is present first (safer).
  if (newFilename) {
    const up = await uploadWordFieldAudioToAnki(newFilename, anki);
    if (!up.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: up.error,
          modelName,
          noteId,
          ankiLinkId,
          oldValue,
          newValue,
          oldFilename,
          newFilename,
          media,
        },
        { status: 500 },
      );
    }
    media.push({ step: "storeMediaFile", ok: true, filename: newFilename });
  }

  const upd = await anki.updateNoteFields({
    note: { id: noteId, fields: { sentence_en: newValue } },
  });
  if (!upd.ok) {
    return NextResponse.json(
      {
        ok: false as const,
        error: upd.error,
        modelName,
        noteId,
        ankiLinkId,
        oldValue,
        newValue,
        oldFilename,
        newFilename,
        media,
      },
      { status: 502 },
    );
  }

  // Remove the old media file if it's different from the new one.
  if (oldFilename && oldFilename !== newFilename) {
    const del = await deleteMediaIfExists(oldFilename, anki);
    media.push(
      del.ok
        ? { step: "deleteMediaFile", ok: true, filename: oldFilename }
        : { step: "deleteMediaFile", ok: false, filename: oldFilename, error: del.error },
    );
  }

  return NextResponse.json(
    {
      ok: true as const,
      changed: true,
      modelName,
      noteId,
      ankiLinkId,
      oldValue,
      newValue,
      oldFilename,
      newFilename,
      media,
    },
    { status: 200 },
  );
}
