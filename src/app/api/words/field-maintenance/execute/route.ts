import "server-only";

import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/apiAuth";

import {
  executeWordSenseFieldMaintenance,
  executeScopedSentenceLinkMaintenance,
  isWordMaintenanceField,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as {
    field?: unknown;
    expectedAffectedRows?: unknown;
    confirmation?: unknown;
    previewId?: unknown;
    requestId?: unknown;
  } | null;
  if (body?.field === "sentenceIds") {
    if (
      typeof body.previewId !== "string" || !body.previewId ||
      typeof body.requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestId) ||
      typeof body.confirmation !== "string"
    ) {
      return NextResponse.json({ ok: false, error: "A valid preview, request id, and confirmation are required." }, { status: 400 });
    }
    try {
      return NextResponse.json({
        ok: true,
        result: await executeScopedSentenceLinkMaintenance({
          previewId: body.previewId,
          requestId: body.requestId,
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
  if (
    !isWordMaintenanceField(body?.field) ||
    !Number.isSafeInteger(body?.expectedAffectedRows) ||
    Number(body?.expectedAffectedRows) < 0 ||
    typeof body?.confirmation !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "Body must include a supported field, affected-row count, and confirmation text." },
      { status: 400 },
    );
  }
  try {
    const result = await executeWordSenseFieldMaintenance({
      field: body.field,
      expectedAffectedRows: Number(body.expectedAffectedRows),
      confirmation: body.confirmation,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}
