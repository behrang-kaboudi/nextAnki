import { NextResponse } from "next/server";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";
import { AnkiNoteTypes } from "@/lib/AnkiDeck";
import { getAnkiLinkIdFromNoteFields } from "@/lib/anki/wordAnkiMapping";

export const runtime = "nodejs";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST() {
  const anki = createAnkiConnectClient({ timeoutMs: 30_000, retryDelayMs: 1000 });

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  const query = `note:"${modelName.replaceAll('"', '\\"')}"`;

  const found = await anki.requestDetailed("findNotes", { query });
  if (!found.ok) {
    return NextResponse.json({ ok: false as const, error: found.error }, { status: 502 });
  }

  const noteIds = found.result ?? [];
  const totalNotes = noteIds.length;

  const byLinkId = new Map<string, number[]>();
  let missingLinkId = 0;

  for (const batch of chunk(noteIds, 250)) {
    const info = await anki.requestDetailed("notesInfo", { notes: batch });
    if (!info.ok) {
      return NextResponse.json({ ok: false as const, error: info.error }, { status: 502 });
    }

    for (const n of info.result ?? []) {
      const linkId = getAnkiLinkIdFromNoteFields(n);
      if (!linkId) {
        missingLinkId += 1;
        continue;
      }
      const prev = byLinkId.get(linkId);
      if (prev) prev.push(n.noteId);
      else byLinkId.set(linkId, [n.noteId]);
    }
  }

  const uniqueLinkIds = byLinkId.size;

  const duplicates = Array.from(byLinkId.entries())
    .filter(([, ids]) => ids.length > 1)
    .map(([anki_link_id, ids]) => ({ anki_link_id, count: ids.length, noteIds: ids }))
    .sort((a, b) => b.count - a.count || a.anki_link_id.localeCompare(b.anki_link_id));

  const duplicateLinkIds = duplicates.length;
  const duplicateNotesExtra = duplicates.reduce((sum, d) => sum + (d.count - 1), 0);
  const maxDupCount = duplicates[0]?.count ?? 0;

  const top = duplicates.slice(0, 100).map((d) => ({
    anki_link_id: d.anki_link_id,
    count: d.count,
    noteIds: d.noteIds.slice(0, 50),
  }));

  return NextResponse.json(
    {
      ok: true as const,
      modelName,
      query,
      totalNotes,
      missingLinkId,
      uniqueLinkIds,
      duplicateLinkIds,
      duplicateNotesExtra,
      maxDupCount,
      topDuplicates: top,
    },
    { status: 200 },
  );
}
