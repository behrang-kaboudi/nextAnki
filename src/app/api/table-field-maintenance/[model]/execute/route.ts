import "server-only";

import { NextResponse } from "next/server";

import {
  executeTableFieldMaintenance,
  isTableMaintenanceModel,
  isTableMaintenanceSelection,
} from "@/lib/field-maintenance/tableFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ model: string }> }) {
  const [{ model }, body] = await Promise.all([
    params,
    request.json().catch(() => null) as Promise<{ field?: unknown; expectedAffectedRows?: unknown; confirmation?: unknown } | null>,
  ]);
  if (!isTableMaintenanceModel(model) || !isTableMaintenanceSelection(model, body?.field) || !Number.isSafeInteger(body?.expectedAffectedRows) || Number(body?.expectedAffectedRows) < 0 || typeof body?.confirmation !== "string") {
    return NextResponse.json({ ok: false, error: "Body must include a supported field, affected-row count, and confirmation text." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, result: await executeTableFieldMaintenance({ model, field: body.field, expectedAffectedRows: Number(body.expectedAffectedRows), confirmation: body.confirmation }) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
