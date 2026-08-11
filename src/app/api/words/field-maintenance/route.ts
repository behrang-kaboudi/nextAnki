import "server-only";

import { NextResponse } from "next/server";

import {
  listWordFieldMaintenanceOperations,
  listWordMaintenancePolicies,
} from "@/lib/words/wordFieldMaintenance.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [operations] = await Promise.all([listWordFieldMaintenanceOperations()]);
    return NextResponse.json({
      ok: true,
      fields: listWordMaintenancePolicies(),
      operations,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
