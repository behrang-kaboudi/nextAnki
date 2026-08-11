import "server-only";

import { NextResponse } from "next/server";

import {
  isTableMaintenanceModel,
  listTableFieldMaintenanceOperations,
  listTableMaintenancePolicies,
} from "@/lib/field-maintenance/tableFieldMaintenance.server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ model: string }> }) {
  const { model } = await params;
  if (!isTableMaintenanceModel(model)) return NextResponse.json({ ok: false, error: "Unsupported model." }, { status: 404 });
  try {
    return NextResponse.json({
      ok: true,
      fields: listTableMaintenancePolicies(model),
      operations: await listTableFieldMaintenanceOperations(model),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
