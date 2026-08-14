import "server-only";

import { NextResponse } from "next/server";

import {
  listWordSenseFieldMaintenanceOperations,
  listWordMaintenancePolicies,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [operations] = await Promise.all([listWordSenseFieldMaintenanceOperations()]);
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
