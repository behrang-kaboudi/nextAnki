import "server-only";

import { NextResponse } from "next/server";

import { applyWordSenseIdiomReview } from "@/lib/words/wordSenseIdiomReview.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.sourceRecords)) {
    return NextResponse.json({ ok: false, error: "Body must include sourceRecords and decisions." }, { status: 400 });
  }
  const sourceRecords = body.sourceRecords.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    return typeof item.id === "number" && Number.isSafeInteger(item.id) && item.id > 0 &&
      typeof item.updatedAt === "string"
      ? [{ id: item.id, updatedAt: item.updatedAt }]
      : [];
  });
  if (sourceRecords.length !== body.sourceRecords.length) {
    return NextResponse.json({ ok: false, error: "Invalid sourceRecords." }, { status: 400 });
  }
  try {
    return NextResponse.json({
      ok: true,
      ...(await applyWordSenseIdiomReview(sourceRecords, body.decisions)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
