import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type LookupInputItem = {
  base_form?: unknown;
  anki_link_id?: unknown;
};

type JsonHintCandidate = {
  target_lang?: unknown;
  anki_link_id?: unknown;
};

type JsonHintShape = {
  person?: JsonHintCandidate | null;
  job?: JsonHintCandidate | null;
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonHint(value: unknown): JsonHintShape | null {
  if (value == null) return null;
  if (typeof value === "object") return value as JsonHintShape;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as JsonHintShape;
  } catch {
    return null;
  }
}

function collectNestedEnAnkiLinkIds(jsonHint: unknown) {
  const parsed = parseJsonHint(jsonHint);
  if (!parsed) return [];

  const out: string[] = [];
  for (const candidate of [parsed.person, parsed.job]) {
    if (!candidate) continue;
    if (asTrimmedString(candidate.target_lang) !== "en") continue;
    const ankiLinkId = asTrimmedString(candidate.anki_link_id);
    if (!ankiLinkId) continue;
    out.push(ankiLinkId);
  }

  return out;
}

function chunkArray<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: "Body must be a JSON array." },
        { status: 400 },
      );
    }

    const items = body as LookupInputItem[];
    const baseForms = items
      .map((item) => asTrimmedString(item?.base_form))
      .filter(Boolean);
    const directAnkiLinkIds = items
      .map((item) => asTrimmedString(item?.anki_link_id))
      .filter(Boolean);

    if (!baseForms.length && !directAnkiLinkIds.length) {
      return NextResponse.json({ ok: true, noteIds: [] });
    }

    const rows = await prisma.word.findMany({
      where: { base_form: { in: Array.from(new Set(baseForms)) } },
      select: { id: true, base_form: true, anki_link_id: true },
      orderBy: [{ id: "asc" }],
    });

    const noteIdsByBaseForm = new Map<string, string[]>();
    for (const row of rows) {
      const current = noteIdsByBaseForm.get(row.base_form);
      if (current) current.push(row.anki_link_id);
      else noteIdsByBaseForm.set(row.base_form, [row.anki_link_id]);
    }

    const noteIds: string[] = [];
    const seenNoteIds = new Set<string>();
    const pendingAnkiLinkIds: string[] = [];
    const queuedAnkiLinkIds = new Set<string>();

    for (const ankiLinkId of directAnkiLinkIds) {
      if (seenNoteIds.has(ankiLinkId)) continue;
      seenNoteIds.add(ankiLinkId);
      noteIds.push(ankiLinkId);
      if (queuedAnkiLinkIds.has(ankiLinkId)) continue;
      queuedAnkiLinkIds.add(ankiLinkId);
      pendingAnkiLinkIds.push(ankiLinkId);
    }

    for (const item of items) {
      const baseForm = asTrimmedString(item?.base_form);
      if (!baseForm) continue;
      for (const noteId of noteIdsByBaseForm.get(baseForm) ?? []) {
        if (seenNoteIds.has(noteId)) continue;
        seenNoteIds.add(noteId);
        noteIds.push(noteId);
        if (queuedAnkiLinkIds.has(noteId)) continue;
        queuedAnkiLinkIds.add(noteId);
        pendingAnkiLinkIds.push(noteId);
      }
    }

    while (pendingAnkiLinkIds.length) {
      const currentBatch = pendingAnkiLinkIds.splice(0, 200);
      const batchRows = [];
      for (const group of chunkArray(currentBatch, 200)) {
        const groupRows = await prisma.word.findMany({
          where: { anki_link_id: { in: group } },
          select: { anki_link_id: true, json_hint: true },
        });
        batchRows.push(...groupRows);
      }

      for (const row of batchRows) {
        for (const nestedNoteId of collectNestedEnAnkiLinkIds(row.json_hint)) {
          if (!seenNoteIds.has(nestedNoteId)) {
            seenNoteIds.add(nestedNoteId);
            noteIds.push(nestedNoteId);
          }
          if (queuedAnkiLinkIds.has(nestedNoteId)) continue;
          queuedAnkiLinkIds.add(nestedNoteId);
          pendingAnkiLinkIds.push(nestedNoteId);
        }
      }
    }

    return NextResponse.json({ ok: true, noteIds });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
