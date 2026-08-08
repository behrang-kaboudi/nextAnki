import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { touchWordsLinkedToSentenceId } from "@/lib/words/wordRepo";
import fsp from "node:fs/promises";
import path from "node:path";
import { getSentenceAudioAbsolutePath } from "@/lib/audio/sentenceAudioPaths.server";

export const runtime = "nodejs";

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = asString(value);
  if (s === null) return undefined;
  const trimmed = s.trim();
  return trimmed.length ? s : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const id = asPositiveInt((body as { id?: unknown } | null)?.id);
    const data = (body as { data?: unknown } | null)?.data;
    const preserveAudioFieldsRaw = (body as { preserveAudioFields?: unknown } | null)?.preserveAudioFields;
    const preserveAudioFields = new Set(
      Array.isArray(preserveAudioFieldsRaw)
        ? preserveAudioFieldsRaw.filter((field) => field === "sentence_en" || field === "sentence_en_meaning_fa")
        : [],
    );

    if (!id || !data || typeof data !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body must include { id: number, data: object }" },
        { status: 400 },
      );
    }

    const d = data as Record<string, unknown>;
    const sentence_en_raw = asString(d.sentence_en);
    const sentence_en = sentence_en_raw?.trim();

    if (!sentence_en) {
      return NextResponse.json({ ok: false, error: "sentence_en is required." }, { status: 400 });
    }

    const existing = await prisma.sentence.findUnique({
      where: { id },
      select: {
        id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
        sentence_en_audio_file_name: true,
        sentence_en_meaning_fa_audio_file_name: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: `Sentence ${id} not found.` }, { status: 404 });
    }

    const duplicate = await prisma.sentence.findFirst({
      where: { sentence_en, id: { not: id } },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { ok: false, error: `sentence_en already exists on Sentence ${duplicate.id}.` },
        { status: 409 },
      );
    }

    const sentence_en_meaning_fa = normalizeNullableString(d.sentence_en_meaning_fa) ?? null;
    const sentenceChanged = sentence_en !== existing.sentence_en;
    const meaningChanged = sentence_en_meaning_fa !== existing.sentence_en_meaning_fa;
    const clearSentenceAudio = sentenceChanged && !preserveAudioFields.has("sentence_en");
    const clearMeaningAudio = meaningChanged && !preserveAudioFields.has("sentence_en_meaning_fa");
    const updated = await prisma.sentence.update({
      where: { id },
      data: {
        sentence_en,
        sentence_en_meaning_fa,
        ...(clearSentenceAudio ? { sentence_en_audio_file_name: null } : {}),
        ...(clearMeaningAudio ? { sentence_en_meaning_fa_audio_file_name: null } : {}),
      },
      select: {
        id: true,
        sentence_en: true,
        sentence_en_meaning_fa: true,
        updatedAt: true,
      },
    });

    const touchedWords = await touchWordsLinkedToSentenceId(id);
    const staleFiles = [
      clearSentenceAudio ? existing.sentence_en_audio_file_name : null,
      clearMeaningAudio ? existing.sentence_en_meaning_fa_audio_file_name : null,
    ].filter((filename): filename is string => Boolean(filename) && path.basename(filename!) === filename);
    await Promise.allSettled(staleFiles.map((filename) => fsp.rm(getSentenceAudioAbsolutePath(filename), { force: true })));

    return NextResponse.json({
      ok: true as const,
      item: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
      touchedWords: touchedWords.count,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
