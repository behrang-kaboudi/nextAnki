import { NextResponse } from "next/server";

import { startSentenceDeckSyncAllIfNeeded } from "@/lib/anki/sentenceDeckSyncAllJob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    limit?: unknown;
  } | null;
  const limitRaw =
    typeof body?.limit === "number" ? body.limit : Number(body?.limit ?? 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.trunc(limitRaw))
    : 10;

  const status = startSentenceDeckSyncAllIfNeeded(limit);
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}
