import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/auth/apiAuth";
import { createAnkiOperations } from "@/lib/anki";
import { AnkiNoteTypes } from "@/lib/anki";

const DEFAULT_QUERY = `note:"${AnkiNoteTypes.META_LEX_VR9}"`;
const NOTES_INFO_BATCH_SIZE = 1000;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickAnkiLinkId(fields: Record<string, { value: string }>): string | null {
  const candidates = ["anki_link_id", "AnkiLinkId"];
  for (const k of candidates) {
    const v = fields?.[k]?.value ?? "";
    const s = String(v)
      .replace(/<br\s*\/?>/gi, "")
      .trim();
    if (s) return s;
  }
  return null;
}

function pickFieldValue(
  fields: Record<string, { value: string }>,
  candidates: string[],
): string {
  for (const k of candidates) {
    const v = fields?.[k]?.value ?? "";
    const s = String(v).replace(/<br\s*\/?>/gi, "").trim();
    if (s) return s;
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const authRes = await requireApiAuth();
    if (!authRes.ok) return NextResponse.json({ error: "Unauthorized" }, { status: authRes.status });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const query = String((body as { query?: unknown })?.query ?? DEFAULT_QUERY).trim() || DEFAULT_QUERY;
    const limitRaw = Number((body as { limit?: unknown })?.limit ?? 5000);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50_000, Math.trunc(limitRaw))) : 5000;

    const client = createAnkiOperations({ timeoutMs: 30_000 });
    const [noteIdsRes, wordRows] = await Promise.all([
      client.findNotes({ query }),
      prisma.wordSense.findMany({ select: { anki_link_id: true } }),
    ]);
    if (!noteIdsRes.ok) {
      return NextResponse.json({ ok: false, error: noteIdsRes.error }, { status: 502 });
    }

    const allNoteIds = Array.isArray(noteIdsRes.result) ? noteIdsRes.result.slice(0, limit) : [];
    if (!allNoteIds.length) {
      return NextResponse.json({ query, totalNotes: 0, checkedNotes: 0, missing: [] });
    }

    const infos: Array<{
      noteId: number;
      modelName: string;
      fields: Record<string, { value: string; order: number }>;
    }> = [];

    for (const group of chunk(allNoteIds, NOTES_INFO_BATCH_SIZE)) {
      const res = await client.notesInfo({ notes: group });
      if (!res.ok || !res.result) {
        return NextResponse.json({ ok: false, error: res.ok ? "Failed to read notesInfo from AnkiConnect." : res.error }, { status: 502 });
      }
      infos.push(...res.result);
    }

    const records = infos
      .map((n) => {
        const anki_link_id = pickAnkiLinkId(n.fields);
        const base_form = pickFieldValue(n.fields, ["base_form", "BaseForm", "Base_Form", "Base form"]);
        const meaning_fa = pickFieldValue(n.fields, ["meaning_fa", "MeaningFa", "Meaning_fa", "Meaning FA", "Meaning"]);
        return { noteId: n.noteId, modelName: n.modelName, anki_link_id, base_form, meaning_fa };
      })
      .filter((r) => r.anki_link_id);

    const existing = new Set(wordRows.map((row) => row.anki_link_id));

    const missing = records
      .filter((r) => r.anki_link_id && !existing.has(r.anki_link_id))
      .map((r) => ({
        noteId: r.noteId,
        modelName: r.modelName,
        anki_link_id: r.anki_link_id!,
        base_form: r.base_form ?? "",
        meaning_fa: r.meaning_fa ?? "",
      }));

    return NextResponse.json({
      query,
      totalNotes: Array.isArray(noteIdsRes.result) ? noteIdsRes.result.length : 0,
      checkedNotes: allNoteIds.length,
      missing,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
