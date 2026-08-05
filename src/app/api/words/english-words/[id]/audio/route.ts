import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { buildEnglishWordAudioFilename, getEnglishWordAudioPublicPath } from "@/lib/audio/englishWordAudioNaming";
import { getEnglishWordAudioAbsoluteDir, getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseId(value: string) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
function runFfmpeg(args: string[]) { return new Promise<void>((resolve, reject) => { const child = spawn("ffmpeg", args, { windowsHide: true }); let stderr = ""; child.stderr.on("data", (data) => (stderr += String(data))); child.on("error", reject); child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr.trim()}`)))); }); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id." }, { status: 400 });
  let tmpInput: string | null = null; let tmpOutput: string | null = null;
  try {
    const audio = (await request.formData()).get("audio");
    if (!(audio instanceof File) || audio.size <= 0) return NextResponse.json({ ok: false, error: "A non-empty audio file is required." }, { status: 400 });
    if (audio.size > 15 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Audio is too large (maximum 15 MB)." }, { status: 413 });
    const row = await prisma.englishWord.findUnique({ where: { id }, select: { id: true, audio_file_name: true } });
    if (!row) return NextResponse.json({ ok: false, error: "EnglishWord not found." }, { status: 404 });
    const tempDir = path.join(os.tmpdir(), "nextAnki_englishWordAudio"); await fsp.mkdir(tempDir, { recursive: true });
    tmpInput = path.join(tempDir, `${crypto.randomUUID()}${path.extname(audio.name).toLowerCase() || ".webm"}`); tmpOutput = path.join(tempDir, `${crypto.randomUUID()}.mp3`);
    await fsp.writeFile(tmpInput, Buffer.from(await audio.arrayBuffer())); await runFfmpeg(["-y", "-i", tmpInput, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "128k", tmpOutput]);
    const filename = buildEnglishWordAudioFilename({ englishWordId: id }); await fsp.mkdir(getEnglishWordAudioAbsoluteDir(), { recursive: true }); await fsp.copyFile(tmpOutput, getEnglishWordAudioAbsolutePath(filename)); await prisma.englishWord.update({ where: { id }, data: { audio_file_name: filename } });
    if (row.audio_file_name && path.basename(row.audio_file_name) === row.audio_file_name) await fsp.rm(getEnglishWordAudioAbsolutePath(row.audio_file_name), { force: true });
    return NextResponse.json({ ok: true, filename, publicPath: getEnglishWordAudioPublicPath(filename) });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save recorded audio." }, { status: 500 }); }
  finally { await Promise.allSettled([tmpInput ? fsp.rm(tmpInput, { force: true }) : Promise.resolve(), tmpOutput ? fsp.rm(tmpOutput, { force: true }) : Promise.resolve()]); }
}
