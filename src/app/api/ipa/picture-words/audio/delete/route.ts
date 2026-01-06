import "server-only";

import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import { pictureWordAudioPrefix } from "@/lib/audio/pictureWordAudioNaming";

export const runtime = "nodejs";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "pictureWord");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const row = await prisma.pictureWord.findUnique({
    where: { id },
    select: { id: true, phinglish: true, en: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prefix = pictureWordAudioPrefix(row.phinglish, row.en);
  const files = await fs.readdir(AUDIO_DIR).catch(() => [] as string[]);
  const targets = files.filter((f) => f.startsWith(prefix));
  let deleted = 0;
  for (const f of targets) {
    await fs.rm(path.join(AUDIO_DIR, f), { force: true });
    deleted++;
  }
  return NextResponse.json({ ok: true, deleted });
}

