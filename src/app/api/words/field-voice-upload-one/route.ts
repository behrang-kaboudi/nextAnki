import "server-only";

import { NextResponse } from "next/server";

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordAudioFields";
import { getEnglishWordAudioPublicPath } from "@/lib/audio/englishWordAudioNaming";
import { saveEnglishWordAudioMp3 } from "@/lib/english/englishWordAudio.server";
import { getSentenceAudioPublicPath, isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { saveSentenceAudioMp3 } from "@/lib/sentences/sentenceAudio.server";
import { getWordSenseConceptAudioPublicPath, isWordSenseConceptAudioField } from "@/lib/audio/wordSenseConceptAudioNaming";
import { saveWordSenseConceptAudioMp3 } from "@/lib/words/wordSenseConceptAudio.server";

export const runtime = "nodejs";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asPositiveIntString(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 && String(i) === value ? i : null;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (code ${code}): ${stderr.trim()}`));
    });
  });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const audioKey = asNonEmptyString(form.get("audioKey"));
    const field = form.get("field");
    const audio = form.get("audio");

    if (!audioKey) {
      return NextResponse.json({ ok: false, error: "Invalid audioKey" }, { status: 400 });
    }
    if (typeof field !== "string" || !WORD_AUDIO_FIELDS.includes(field as never)) {
      return NextResponse.json(
        { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }
    if (!(audio instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing audio file" }, { status: 400 });
    }
    if (audio.size <= 0) {
      return NextResponse.json({ ok: false, error: "Empty audio file" }, { status: 400 });
    }
    if (audio.size > 15 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Audio too large (max 15MB)" }, { status: 413 });
    }

    const tmpDir = path.join(os.tmpdir(), "nextAnki_wordFieldVoice");
    await fsp.mkdir(tmpDir, { recursive: true });

    const ext = path.extname(audio.name || "").toLowerCase() || ".webm";
    const tmpInput = path.join(tmpDir, `${crypto.randomUUID()}${ext}`);
    const tmpOutput = path.join(tmpDir, `${crypto.randomUUID()}.mp3`);

    const buf = Buffer.from(await audio.arrayBuffer());
    await fsp.writeFile(tmpInput, buf);

    try {
      await runFfmpeg([
        "-y",
        "-i",
        tmpInput,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "44100",
        "-b:a",
        "128k",
        tmpOutput,
      ]);

      if (field === "base_form") {
        const englishWordId = asPositiveIntString(audioKey);
        if (!englishWordId) throw new Error("Invalid EnglishWord id");
        const result = await saveEnglishWordAudioMp3(englishWordId, tmpOutput);
        return NextResponse.json({
          ok: true,
          filename: result.filename,
          publicPath: result.filename ? getEnglishWordAudioPublicPath(result.filename) : null,
          size: result.size,
        });
      }

      if (isSentenceAudioField(field)) {
        const sentenceId = asPositiveIntString(audioKey);
        if (!sentenceId) throw new Error("Invalid Sentence id");
        const result = await saveSentenceAudioMp3(sentenceId, field, tmpOutput);
        return NextResponse.json({
          ok: true,
          filename: result.filename,
          publicPath: getSentenceAudioPublicPath(result.filename),
          size: result.size,
        });
      }

      if (isWordSenseConceptAudioField(field)) {
        const wordId = asPositiveIntString(audioKey);
        if (!wordId) throw new Error("Invalid WordSense id");
        const result = await saveWordSenseConceptAudioMp3(wordId, tmpOutput);
        return NextResponse.json({
          ok: true,
          filename: result.filename,
          publicPath: result.filename ? getWordSenseConceptAudioPublicPath(result.filename) : null,
          size: result.size,
        });
      }

      return NextResponse.json({ ok: false, error: "Unsupported field" }, { status: 400 });
    } finally {
      await Promise.allSettled([
        fsp.rm(tmpInput, { force: true }),
        fsp.rm(tmpOutput, { force: true }),
      ]);
    }
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
