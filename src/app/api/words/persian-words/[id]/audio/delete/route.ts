import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getPersianWordAudioAbsolutePath } from "@/lib/audio/persianWordAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });
  try {
    const row = await prisma.persianWord.findUnique({ where: { id }, select: { audio_file_name: true } });
    if (!row) return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
    await prisma.persianWord.update({ where: { id }, data: { audio_file_name: null } });
    await touchWordsReferencingPersianWord(id);
    if (row.audio_file_name && path.basename(row.audio_file_name) === row.audio_file_name) {
      await fs.rm(getPersianWordAudioAbsolutePath(row.audio_file_name), { force: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not delete audio." }, { status: 500 });
  }
}
