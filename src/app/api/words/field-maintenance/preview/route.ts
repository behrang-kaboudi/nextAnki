import "server-only";

import { NextResponse } from "next/server";

import {
  isWordMaintenanceSelectionKey,
  previewWordFieldSelection,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { field?: unknown } | null;
  if (!isWordMaintenanceSelectionKey(body?.field)) {
    return NextResponse.json({ ok: false, error: "Invalid or unsupported WordSense field." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, preview: await previewWordFieldSelection(body.field) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
