import "server-only";

import crypto from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { NextResponse } from "next/server";

import {
  buildPersianWordCanonicalTextAudioFilename,
  getPersianWordAudioPublicPath,
} from "@/lib/audio/persianWordAudioNaming";
import { getPersianWordAudioAbsoluteDir, getPersianWordAudioAbsolutePath } from "@/lib/audio/persianWordAudioPaths.server";
import { prisma } from "@/lib/prisma";
import { touchWordsReferencingPersianWord } from "@/lib/words/persianMeanings.server";

export const runtime = "nodejs";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (data) => (stderr += String(data)));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr.trim()}`))));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });

  let tmpInput: string | null = null;
  let tmpOutput: string | null = null;
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size <= 0) {
      return NextResponse.json({ ok: false, error: "A non-empty audio file is required." }, { status: 400 });
    }
    if (audio.size > 15 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Audio is too large (maximum 15 MB)." }, { status: 413 });
    }

    const row = await prisma.persianWord.findUnique({ where: { id }, select: { id: true, audio_file_name: true } });
    if (!row) return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });

    const tempDir = path.join(os.tmpdir(), "nextAnki_persianWordAudio");
    await fsp.mkdir(tempDir, { recursive: true });
    const extension = path.extname(audio.name).toLowerCase() || ".webm";
    tmpInput = path.join(tempDir, `${crypto.randomUUID()}${extension}`);
    tmpOutput = path.join(tempDir, `${crypto.randomUUID()}.mp3`);
    await fsp.writeFile(tmpInput, Buffer.from(await audio.arrayBuffer()));
    await runFfmpeg(["-y", "-i", tmpInput, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "128k", tmpOutput]);

    const filename = buildPersianWordCanonicalTextAudioFilename({ persianWordId: id });
    await fsp.mkdir(getPersianWordAudioAbsoluteDir(), { recursive: true });
    await fsp.copyFile(tmpOutput, getPersianWordAudioAbsolutePath(filename));
    await prisma.persianWord.update({ where: { id }, data: { audio_file_name: filename } });
    await touchWordsReferencingPersianWord(id);

    if (row.audio_file_name && path.basename(row.audio_file_name) === row.audio_file_name) {
      await fsp.rm(getPersianWordAudioAbsolutePath(row.audio_file_name), { force: true });
    }

    return NextResponse.json({ ok: true, filename, publicPath: getPersianWordAudioPublicPath(filename) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save recorded audio." },
      { status: 500 },
    );
  } finally {
    await Promise.allSettled([tmpInput ? fsp.rm(tmpInput, { force: true }) : Promise.resolve(), tmpOutput ? fsp.rm(tmpOutput, { force: true }) : Promise.resolve()]);
  }
}
