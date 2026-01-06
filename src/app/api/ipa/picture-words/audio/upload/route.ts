import "server-only";

import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

import { prisma } from "@/lib/prisma";
import { buildPictureWordAudioFilename } from "@/lib/audio/pictureWordAudioNaming";

export const runtime = "nodejs";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "pictureWord");

function run(cmd: string, args: string[]) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += String(d)));
    child.stderr.on("data", (d) => (stderr += String(d)));
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function parseAstasDb(stderr: string) {
  // astats prints repeated blocks; take the last seen values.
  let rmsDb: number | null = null;
  let peakDb: number | null = null;
  const rmsRe = /RMS level dB:\s*(-?\d+(?:\.\d+)?)/g;
  const peakRe = /Peak level dB:\s*(-?\d+(?:\.\d+)?)/g;
  for (;;) {
    const m = rmsRe.exec(stderr);
    if (!m) break;
    rmsDb = Number(m[1]);
  }
  for (;;) {
    const m = peakRe.exec(stderr);
    if (!m) break;
    peakDb = Number(m[1]);
  }
  return { rmsDb: Number.isFinite(rmsDb) ? rmsDb : null, peakDb: Number.isFinite(peakDb) ? peakDb : null };
}

export async function POST(req: Request) {
  const form = await req.formData();
  const id = Number(form.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const normalize = form.get("normalize") === "1";
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });

  const row = await prisma.pictureWord.findUnique({
    where: { id },
    select: { id: true, phinglish: true, en: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await fs.mkdir(AUDIO_DIR, { recursive: true });

  const tmpBase = path.join(process.cwd(), ".next", "tmp-audio");
  await fs.mkdir(tmpBase, { recursive: true });
  const tmpIn = path.join(tmpBase, `${Date.now()}-${Math.random().toString(16).slice(2)}.upload`);
  const tmpOut = path.join(tmpBase, `${Date.now()}-${Math.random().toString(16).slice(2)}.out.webm`);

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(tmpIn, buf);

    const filter = normalize ? "loudnorm=I=-16:LRA=11:TP=-1.5" : "anull";
    const conv = await run("ffmpeg", ["-y", "-i", tmpIn, "-vn", "-af", filter, "-c:a", "libopus", "-b:a", "96k", tmpOut]);
    if (conv.code !== 0) {
      return NextResponse.json({ error: "ffmpeg convert failed", details: conv.stderr.slice(-2000) }, { status: 500 });
    }

    const stats = await run("ffmpeg", ["-i", tmpOut, "-af", "astats=metadata=1:reset=1", "-f", "null", "-"]);
    const loudness = parseAstasDb(stats.stderr);

    const filename = buildPictureWordAudioFilename({
      phinglish: row.phinglish,
      en: row.en,
      timestampMs: Date.now(),
      rmsDb: loudness.rmsDb,
      peakDb: loudness.peakDb,
      ext: "webm",
    });
    const finalPath = path.join(AUDIO_DIR, filename);
    await fs.rename(tmpOut, finalPath);

    return NextResponse.json({
      ok: true,
      file: filename,
      url: `/audio/pictureWord/${encodeURIComponent(filename)}`,
      loudness,
    });
  } finally {
    await fs.rm(tmpIn, { force: true }).catch(() => {});
    await fs.rm(tmpOut, { force: true }).catch(() => {});
  }
}

