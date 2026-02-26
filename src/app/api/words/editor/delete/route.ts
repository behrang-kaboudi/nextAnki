import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { prisma } from "@/lib/prisma";
import { deleteAllWordFieldAudioFiles } from "@/lib/words/wordFieldVoice";
import { deleteWord } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const id = asPositiveInt((body as { id?: unknown } | null)?.id);
    if (!id) {
      return NextResponse.json({ ok: false, error: "Body must include { id: number }" }, { status: 400 });
    }

    const word = await prisma.word.findUnique({
      where: { id },
      select: { id: true, anki_link_id: true },
    });
    if (!word) {
      return NextResponse.json({ ok: false, error: "Word not found" }, { status: 404 });
    }

    const audio = await Promise.all(
      WORD_AUDIO_FIELDS.map(async (field) => {
        const res = await deleteAllWordFieldAudioFiles({ ankiLinkId: word.anki_link_id, field });
        return { field, ...res };
      }),
    );

    await deleteWord({ where: { id } });

    return NextResponse.json({ ok: true as const, deletedId: id, deletedAudio: audio });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

