import "server-only";

import { NextResponse } from "next/server";

import {
  isTableMaintenanceModel,
  isTableMaintenanceSelection,
  previewTableFieldSelection,
} from "@/lib/field-maintenance/tableFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ model: string }> }) {
  const [{ model }, body] = await Promise.all([
    params,
    request.json().catch(() => null) as Promise<{ field?: unknown } | null>,
  ]);
  if (!isTableMaintenanceModel(model) || !isTableMaintenanceSelection(model, body?.field)) {
    return NextResponse.json({ ok: false, error: "Invalid or unsupported field." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, preview: await previewTableFieldSelection(model, body.field) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
