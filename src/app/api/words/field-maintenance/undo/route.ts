import "server-only";

import { NextResponse } from "next/server";

import { undoWordSenseFieldMaintenance } from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { operationId?: unknown } | null;
  if (typeof body?.operationId !== "string" || !body.operationId.trim()) {
    return NextResponse.json({ ok: false, error: "operationId is required." }, { status: 400 });
  }
  try {
    return NextResponse.json({
      ok: true,
      result: await undoWordSenseFieldMaintenance(body.operationId),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}
