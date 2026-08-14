import "server-only";

import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/apiAuth";

import { undoWordSenseFieldMaintenance } from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
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
