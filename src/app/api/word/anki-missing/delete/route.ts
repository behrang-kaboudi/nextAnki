import "server-only";

import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/apiAuth";
import { createAnkiConnectClient } from "@/lib/AnkiConnect";

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseNoteIds(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((x) => (typeof x === "number" ? x : Number(String(x).trim())))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n))
        .filter((n) => n > 0),
    ),
  );
}

export async function POST(req: Request) {
  const authRes = await requireApiAuth();
  if (!authRes.ok) return NextResponse.json({ error: "Unauthorized" }, { status: authRes.status });

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const noteIds = parseNoteIds((body as { noteIds?: unknown })?.noteIds);
    if (!noteIds.length) return NextResponse.json({ deleted: 0 });

    const client = createAnkiConnectClient({ timeoutMs: 30_000 });

    const permRes = await client.requestDetailed("requestPermission");
    if (!permRes.ok) {
      return NextResponse.json(
        { error: `AnkiConnect requestPermission failed: ${permRes.error}` },
        { status: 502 },
      );
    }
    const perm = permRes.result;
    if (!perm) {
      return NextResponse.json({ error: "AnkiConnect returned null for requestPermission." }, { status: 502 });
    }
    if (perm.permission !== "granted") {
      return NextResponse.json(
        {
          error:
            "AnkiConnect permission denied. In Anki, open AnkiConnect settings and grant permission for this app/action (deleteNotes).",
        },
        { status: 403 },
      );
    }

    let deleted = 0;
    for (const group of chunk(noteIds, 200)) {
      const res = await client.requestDetailed("deleteNotes", { notes: group });
      if (!res.ok) {
        return NextResponse.json(
          { error: `deleteNotes failed via AnkiConnect: ${res.error}` },
          { status: 502 },
        );
      }
      // AnkiConnect `deleteNotes` returns `null` on success.
      deleted += group.length;
    }

    return NextResponse.json({ deleted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
