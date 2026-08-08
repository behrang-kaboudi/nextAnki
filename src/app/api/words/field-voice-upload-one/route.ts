import "server-only";

import { NextResponse } from "next/server";

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

import { WORD_AUDIO_FIELDS, buildWordFieldAudioFilename, getWordFieldAudioPublicPath } from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldAudioAbsoluteDir, getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { touchSentenceById } from "@/lib/sentences/sentenceRepo";
import { deleteAllWordFieldAudioFiles } from "@/lib/words/wordFieldVoice";
import { touchWordByAnkiLinkId, touchWordsLinkedToSentenceId } from "@/lib/words/wordRepo";
import { getSentenceAudioPublicPath, isSentenceAudioField } from "@/lib/audio/sentenceAudioNaming";
import { saveSentenceAudioMp3 } from "@/lib/sentences/sentenceAudio.server";

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

async function touchWordsForAudioChange(audioKey: string, field: string) {
  if (field === "sentence_en" || field === "sentence_en_meaning_fa") {
    const sentenceId = asPositiveIntString(audioKey);
    if (sentenceId) {
      await touchSentenceById(sentenceId);
      await touchWordsLinkedToSentenceId(sentenceId);
    }
    return;
  }
  await touchWordByAnkiLinkId(audioKey);
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

      // Word-owned fields retain the existing audio/words namespace.
      await deleteAllWordFieldAudioFiles({ audioKey, ankiLinkId: audioKey, field: field as never });
      const filename = buildWordFieldAudioFilename({ audioKey, field: field as never, timestampMs: Date.now(), ext: "mp3" });
      fs.mkdirSync(getWordFieldAudioAbsoluteDir(), { recursive: true });
      const outAbs = getWordFieldAudioAbsolutePath(filename);
      await fsp.copyFile(tmpOutput, outAbs);

      let size = 0;
      try {
        size = fs.statSync(outAbs).size;
      } catch {
        size = 0;
      }

      await touchWordsForAudioChange(audioKey, field);

      return NextResponse.json({
        ok: true,
        filename,
        publicPath: getWordFieldAudioPublicPath(filename),
        size,
      });
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
