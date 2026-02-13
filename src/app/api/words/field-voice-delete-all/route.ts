import "server-only";

import { NextResponse } from "next/server";

import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { deleteAllWordFieldAudioFiles } from "@/lib/words/wordFieldVoice";

export const runtime = "nodejs";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { ankiLinkId?: unknown; field?: unknown }
    | null;

  const ankiLinkId = asNonEmptyString(body?.ankiLinkId);
  const field = body?.field;

  if (!ankiLinkId) {
    return NextResponse.json({ ok: false, error: "Invalid ankiLinkId" }, { status: 400 });
  }
  if (typeof field !== "string" || !WORD_AUDIO_FIELDS.includes(field as never)) {
    return NextResponse.json(
      { ok: false, error: `Invalid field. Allowed: ${WORD_AUDIO_FIELDS.join(", ")}` },
      { status: 400 }
    );
  }

  const res = await deleteAllWordFieldAudioFiles({ ankiLinkId, field: field as never });
  return NextResponse.json({ ok: true, ...res });
}

