import { rm } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";
import { touchWordSensesByEnglishId } from "@/lib/words/wordSenseRepo";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function nullableString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id." }, { status: 400 });

  const item = await prisma.englishWord.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ ok: false, error: "EnglishWord not found." }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id." }, { status: 400 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const current = await prisma.englishWord.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ ok: false, error: "EnglishWord not found." }, { status: 404 });

    const base_form = "base_form" in body
      ? normalizeEnglishWordText(typeof body.base_form === "string" ? body.base_form : "")
      : current.base_form;
    const phonetic_us = "phonetic_us" in body ? nullableString(body.phonetic_us) : current.phonetic_us;
    if (!base_form) {
      return NextResponse.json({ ok: false, error: "base_form must contain at least one English letter." }, { status: 400 });
    }
    const item = await prisma.englishWord.update({
      where: { id },
      data: {
        base_form,
        phonetic_us,
        phonetic_us_normalized: phonetic_us ? normalizeIpaForDb(phonetic_us, 2000) || null : null,
        json_hint: "json_hint" in body ? nullableString(body.json_hint) : current.json_hint,
      },
    });
    await touchWordSensesByEnglishId(id, {
      resetConceptMergeReviewed: base_form !== current.base_form,
      resetMeaningsConfirmed: base_form !== current.base_form,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: false, error: "EnglishWord not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "This English base form already exists." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not update EnglishWord." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id." }, { status: 400 });
  try {
    const item = await prisma.englishWord.findUnique({ where: { id } });
    if (!item) return NextResponse.json({ ok: false, error: "EnglishWord not found." }, { status: 404 });
    await prisma.englishWord.delete({ where: { id } });
    if (item.audio_file_name && path.basename(item.audio_file_name) === item.audio_file_name) {
      await rm(getEnglishWordAudioAbsolutePath(item.audio_file_name), { force: true });
    }
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ ok: false, error: "This EnglishWord is still referenced by WordSense rows." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not delete EnglishWord." }, { status: 500 });
  }
}
