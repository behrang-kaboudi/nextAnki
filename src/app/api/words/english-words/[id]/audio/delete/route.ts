import { rm } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { prisma } from "@/lib/prisma";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id." }, { status: 400 });
  try {
    const row = await prisma.englishWord.findUnique({ where: { id }, select: { audio_file_name: true } });
    if (!row) return NextResponse.json({ ok: false, error: "EnglishWord not found." }, { status: 404 });
    await prisma.englishWord.update({ where: { id }, data: { audio_file_name: null } });
    if (row.audio_file_name && path.basename(row.audio_file_name) === row.audio_file_name) {
      await rm(getEnglishWordAudioAbsolutePath(row.audio_file_name), { force: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not delete audio." }, { status: 500 });
  }
}
