import "server-only";

import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/apiAuth";

import {
  listWordSenseFieldMaintenanceOperations,
  listWordMaintenancePolicies,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
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
