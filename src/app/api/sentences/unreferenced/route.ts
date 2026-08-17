import "server-only";

import { NextResponse } from "next/server";

import {
  countUnreferencedSentences,
  deleteUnreferencedSentences,
} from "@/lib/sentences/unreferencedSentenceMaintenance.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ ok: true, count: await countUnreferencedSentences() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as {
    expectedCount?: unknown;
    confirmation?: unknown;
  } | null;
  if (!Number.isSafeInteger(body?.expectedCount) || Number(body?.expectedCount) < 0 || typeof body?.confirmation !== "string") {
    return NextResponse.json(
      { ok: false, error: "Body must include the expected count and deletion confirmation." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json({
      ok: true,
      result: await deleteUnreferencedSentences({
        expectedCount: Number(body.expectedCount),
        confirmation: body.confirmation,
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}
