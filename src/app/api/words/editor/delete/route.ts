import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { prisma } from "@/lib/prisma";
import { deleteAllWordFieldAudioFiles } from "@/lib/words/wordFieldVoice";
import { deleteWord } from "@/lib/words/wordRepo";
import { deleteSentenceAudio } from "@/lib/sentences/sentenceAudio.server";
import { primarySentenceId, wordSentenceIds } from "@/lib/words/sentenceIds";

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
      select: {
        id: true,
        anki_link_id: true,
        sentenceIds: true,
      },
    });
    if (!word) {
      return NextResponse.json({ ok: false, error: "Word not found" }, { status: 404 });
    }

    const primaryId = primarySentenceId(word.sentenceIds);
    const otherSentenceLinks = primaryId
      ? await prisma.word.findMany({ where: { id: { not: id } }, select: { sentenceIds: true } })
      : [];
    const linkedElsewhere = primaryId !== null && otherSentenceLinks.some((other) =>
      wordSentenceIds(other.sentenceIds).includes(primaryId),
    );

    const audio = await Promise.all(
      WORD_AUDIO_FIELDS.filter((field) => field !== "sentence_en" && field !== "sentence_en_meaning_fa").map(async (field) => {
        const audioKey = word.anki_link_id;
        const res = await deleteAllWordFieldAudioFiles({ audioKey, ankiLinkId: audioKey, field });
        return { field, ...res };
      }),
    );

    await deleteWord({ where: { id } });
    if (primaryId != null && !linkedElsewhere) {
      await Promise.all([
        deleteSentenceAudio(primaryId, "sentence_en"),
        deleteSentenceAudio(primaryId, "sentence_en_meaning_fa"),
      ]);
      await prisma.sentence.deleteMany({ where: { id: primaryId } });
    }

    return NextResponse.json({ ok: true as const, deletedId: id, deletedAudio: audio });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
