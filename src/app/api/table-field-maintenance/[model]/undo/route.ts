import "server-only";

import { NextResponse } from "next/server";

import { isTableMaintenanceModel, undoTableFieldMaintenance } from "@/lib/field-maintenance/tableFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ model: string }> }) {
  const [{ model }, body] = await Promise.all([
    params,
    request.json().catch(() => null) as Promise<{ operationId?: unknown } | null>,
  ]);
  if (!isTableMaintenanceModel(model) || typeof body?.operationId !== "string" || !body.operationId.trim()) {
    return NextResponse.json({ ok: false, error: "A supported model and operationId are required." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, result: await undoTableFieldMaintenance(model, body.operationId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
