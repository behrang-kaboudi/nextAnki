import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { normalizePersianFull, normalizePersianHalf } from "@/lib/persian/normalize";
import { prisma } from "@/lib/prisma";
import { getPersianWordReferences, touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function asNullableString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });

  const item = await prisma.persianWord.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
  return NextResponse.json({ ok: true, item, references: await getPersianWordReferences(id) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const current = await prisma.persianWord.findUnique({ where: { id }, select: { canonical_text: true } });
    if (!current) return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
    const canonicalText = normalizePersianHalf(String(body.canonical_text ?? ""));
    const normalizedText = normalizePersianFull(canonicalText);
    const meaningFaIpa = asNullableString(body.meaning_fa_IPA);
    if (!canonicalText || !normalizedText) {
      return NextResponse.json({ ok: false, error: "canonical_text must contain Persian letters." }, { status: 400 });
    }
    const variants = body.not_normalized_texts;
    if (!Array.isArray(variants) || variants.some((value) => typeof value !== "string")) {
      return NextResponse.json({ ok: false, error: "not_normalized_texts must be an array of strings." }, { status: 400 });
    }

    const item = await prisma.persianWord.update({
      where: { id },
      data: {
        canonical_text: canonicalText,
        normalized_text: normalizedText,
        not_normalized_texts: variants as Prisma.InputJsonValue,
        meaning_fa_IPA: meaningFaIpa,
        meaning_fa_IPA_normalize: meaningFaIpa ? normalizeIpaForDb(meaningFaIpa, 2000) : null,
      },
    });
    await touchWordsReferencingPersianWord(id, {
      resetConceptMergeReviewed: canonicalText !== current.canonical_text,
      resetMeaningsConfirmed: canonicalText !== current.canonical_text,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "This value must be unique." }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update PersianWord." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });

  try {
    const item = await prisma.persianWord.findUnique({ where: { id }, select: { id: true } });
    if (!item) return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });

    const [primaryReferences, otherReferences] = await Promise.all([
      prisma.word.findMany({ where: { meaningId: id }, select: { id: true } }),
      prisma.word.findMany({
        where: {
          OR: [
            { otherMeaningIds: { array_contains: id } },
            { otherMeaningIds: { array_contains: String(id) } },
          ],
        },
        select: { id: true },
      }),
    ]);
    const referencingWordIds = [...new Set([...primaryReferences, ...otherReferences].map((word) => word.id))];

    if (referencingWordIds.length) {
      return NextResponse.json(
        {
          ok: false,
          error: `This PersianWord is referenced by ${referencingWordIds.length} Word record(s) and cannot be deleted.`,
          referencingWordIds,
        },
        { status: 409 },
      );
    }

    await prisma.persianWord.delete({ where: { id } });
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not delete PersianWord." },
      { status: 500 },
    );
  }
}
