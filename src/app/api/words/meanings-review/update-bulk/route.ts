import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { addPersianWordWithClient } from "@/lib/tables/persianWord";
import { meaningReviewSentenceIds } from "@/lib/words/meaningReviewSentences.server";
import { updateWord } from "@/lib/words/wordRepo";

export const runtime = "nodejs";

type Correction = {
  id: number;
  meaning_fa?: string;
  other_meanings_fa?: string[];
  invalid_sentence_ids?: number[];
};

function parse(
  value: unknown,
): { ids: number[]; corrections: Correction[] } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).length !== 2 ||
    !Array.isArray(body.ids) ||
    !Array.isArray(body.corrections)
  )
    return null;
  const ids = body.ids;
  if (
    !ids.length ||
    ids.some(
      (id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
    ) ||
    new Set(ids).size !== ids.length
  )
    return null;
  const seen = new Set<number>();
  const corrections: Correction[] = [];
  for (const row of body.corrections) {
    if (!row || typeof row !== "object") return null;
    const item = row as Record<string, unknown>;
    const hasMeanings = "meaning_fa" in item || "other_meanings_fa" in item;
    const hasInvalidSentences = "invalid_sentence_ids" in item;
    if (
      typeof item.id !== "number" ||
      !Number.isSafeInteger(item.id) ||
      seen.has(item.id) ||
      (!hasMeanings && !hasInvalidSentences) ||
      (hasMeanings &&
        (typeof item.meaning_fa !== "string" ||
          !Array.isArray(item.other_meanings_fa) ||
          !item.meaning_fa.trim() ||
          item.other_meanings_fa.some(
            (meaning) => typeof meaning !== "string" || !meaning.trim(),
          ))) ||
      (hasInvalidSentences &&
        (!Array.isArray(item.invalid_sentence_ids) ||
          item.invalid_sentence_ids.some(
            (id) =>
              typeof id !== "number" ||
              !Number.isSafeInteger(id) ||
              id <= 0,
          ) ||
          new Set(item.invalid_sentence_ids).size !==
            item.invalid_sentence_ids.length)) ||
      Object.keys(item).some(
        (key) =>
          ![
            "id",
            "meaning_fa",
            "other_meanings_fa",
            "invalid_sentence_ids",
          ].includes(key),
      )
    )
      return null;
    seen.add(item.id);
    corrections.push({
      id: item.id,
      ...(hasMeanings
        ? {
            meaning_fa: item.meaning_fa as string,
            other_meanings_fa: (item.other_meanings_fa as unknown[]).map(
              (meaning) => (meaning as string).trim(),
            ),
          }
        : {}),
      ...(hasInvalidSentences
        ? { invalid_sentence_ids: item.invalid_sentence_ids as number[] }
        : {}),
    });
  }
  return corrections.every((item) => ids.includes(item.id))
    ? { ids, corrections }
    : null;
}

export async function POST(request: Request) {
  const body = parse(await request.json().catch(() => null));
  if (!body)
    return NextResponse.json(
      {
        ok: false,
        error:
          "Corrections must include meanings and/or invalid_sentence_ids.",
      },
      { status: 400 },
    );
  const corrections = new Map(body.corrections.map((item) => [item.id, item]));
  const results: Array<{ id: number; ok: boolean; error?: string }> = [];
  for (const id of body.ids) {
    try {
      const correction = corrections.get(id);
      await prisma.$transaction(async (tx) => {
        const word = await tx.word.findUnique({
          where: { id },
          select: { sentenceId: true, sentenceIds: true },
        });
        if (!word) throw new Error(`Word ${id} no longer exists.`);
        const referencedSentenceIds = meaningReviewSentenceIds(word);
        const existingSentences = referencedSentenceIds.length
          ? await tx.sentence.findMany({
              where: { id: { in: referencedSentenceIds } },
              select: { id: true },
            })
          : [];
        const existingSentenceIdSet = new Set(
          existingSentences.map((sentence) => sentence.id),
        );
        const currentSentenceIds = referencedSentenceIds.filter((sentenceId) =>
          existingSentenceIdSet.has(sentenceId),
        );
        const invalidSentenceIds = correction?.invalid_sentence_ids ?? [];
        if (invalidSentenceIds.some((sentenceId) => !currentSentenceIds.includes(sentenceId))) {
          throw new Error(`Correction for Word ${id} contains an unrelated sentence id.`);
        }
        const nextSentenceIds = currentSentenceIds.filter(
          (sentenceId) => !invalidSentenceIds.includes(sentenceId),
        );
        let meaningData: {
          meaningId?: number;
          otherMeaningIds?: number[];
        } = {};
        if (correction?.meaning_fa && correction.other_meanings_fa) {
          const primary = await addPersianWordWithClient(
            correction.meaning_fa,
            {},
            tx,
          );
          const otherIds = await Promise.all(
            correction.other_meanings_fa
              .filter((meaning) => meaning !== correction.meaning_fa)
              .map(async (meaning) =>
                (await addPersianWordWithClient(meaning, {}, tx)).item.id,
              ),
          );
          meaningData = {
            meaningId: primary.item.id,
            otherMeaningIds: [
              ...new Set(
                otherIds.filter((otherId) => otherId !== primary.item.id),
              ),
            ],
          };
        }
        await updateWord({
          where: { id },
          data: {
            ...meaningData,
            sentenceId: null,
            sentenceIds: nextSentenceIds,
            meanings_confirmed: true,
          },
          select: { id: true },
        }, tx);
      });
      results.push({ id, ok: true });
    } catch (error) {
      results.push({
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return NextResponse.json({
    ok: true,
    total: body.ids.length,
    updated: results.filter((result) => result.ok).length,
    results,
  });
}
