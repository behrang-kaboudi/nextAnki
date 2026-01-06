import "server-only";

import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

import { prisma } from "@/lib/prisma";
import {
  parsePictureWordAudioFilename,
  pictureWordAudioKey,
  type PictureWordAudioLoudness,
} from "@/lib/audio/pictureWordAudioNaming";

export const runtime = "nodejs";

const AUDIO_DIR = path.join(process.cwd(), "public", "audio", "pictureWord");

type SortMode = "missingAudio" | "id" | "loudness";

function normalizeSort(raw: string | null): SortMode {
  if (raw === "id") return "id";
  if (raw === "loudness") return "loudness";
  return "missingAudio";
}

function bestForKey(files: string[]) {
  // pick newest by timestamp in filename; fallback lexical.
  let best: { file: string; ts: number | null; loudness: PictureWordAudioLoudness } | null = null;
  for (const f of files) {
    const parsed = parsePictureWordAudioFilename(f);
    const ts = parsed.timestampMs;
    if (!best) {
      best = { file: f, ts, loudness: parsed.loudness };
      continue;
    }
    if (ts != null && (best.ts == null || ts > best.ts)) {
      best = { file: f, ts, loudness: parsed.loudness };
      continue;
    }
    if (best.ts == null && ts == null && f > best.file) best = { file: f, ts: null, loudness: parsed.loudness };
  }
  return best;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = normalizeSort(url.searchParams.get("sort"));

  const [rows, files] = await Promise.all([
    prisma.pictureWord.findMany({
      orderBy: [{ id: "asc" }],
      select: {
        id: true,
        fa: true,
        ipa_fa: true,
        phinglish: true,
        en: true,
        type: true,
        ipaVerified: true,
      },
    }),
    fs
      .readdir(AUDIO_DIR)
      .then((list) => list.filter((x) => x && !x.startsWith(".")))
      .catch(() => [] as string[]),
  ]);

  const byKey = new Map<string, string[]>();
  for (const f of files) {
    const parsed = parsePictureWordAudioFilename(f);
    if (!parsed.key) continue;
    const arr = byKey.get(parsed.key) ?? [];
    arr.push(f);
    byKey.set(parsed.key, arr);
  }

  const merged = rows
    .map((r) => {
      const key = pictureWordAudioKey(r.phinglish, r.en);
      const candidates = byKey.get(key) ?? [];
      const best = candidates.length ? bestForKey(candidates) : null;
      const audioFile = best?.file ?? null;
      const audioUrl = audioFile ? `/audio/pictureWord/${encodeURIComponent(audioFile)}` : null;
      const loudness = best?.loudness ?? { rmsDb: null, peakDb: null };
      return {
        ...r,
        hasAudio: Boolean(audioFile),
        audioFile,
        audioUrl,
        loudness,
      };
    })
    .filter((r) => {
      if (!q) return true;
      return (
        String(r.id).includes(q) ||
        r.fa.toLowerCase().includes(q) ||
        r.ipa_fa.toLowerCase().includes(q) ||
        r.phinglish.toLowerCase().includes(q) ||
        r.en.toLowerCase().includes(q)
      );
    });

  merged.sort((a, b) => {
    if (sort === "id") return a.id - b.id;
    if (sort === "loudness") {
      const aVal = a.loudness?.rmsDb;
      const bVal = b.loudness?.rmsDb;
      const aMissing = aVal == null;
      const bMissing = bVal == null;
      if (aMissing !== bMissing) return aMissing ? -1 : 1;
      if (aMissing && bMissing) return a.id - b.id;
      return (bVal ?? -999) - (aVal ?? -999);
    }
    // missingAudio
    if (a.hasAudio !== b.hasAudio) return a.hasAudio ? 1 : -1;
    return a.id - b.id;
  });

  return NextResponse.json({ rows: merged });
}

