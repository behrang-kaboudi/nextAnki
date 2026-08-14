import "server-only";

import { NextResponse } from "next/server";

import {
  executeWordSenseFieldMaintenance,
  isWordMaintenanceField,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    field?: unknown;
    expectedAffectedRows?: unknown;
    confirmation?: unknown;
  } | null;
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
