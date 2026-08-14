import "server-only";

import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/apiAuth";
import { ScopeValidationError } from "@/lib/words/wordSenseMaintenanceScope";

import {
  isWordMaintenanceSelectionKey,
  previewScopedSentenceLinkMaintenance,
  previewWordFieldSelection,
} from "@/lib/words/wordSenseFieldMaintenance.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as {
    field?: unknown;
    scope?: unknown;
    deleteOrphanedSentences?: unknown;
  } | null;
  if (!isWordMaintenanceSelectionKey(body?.field)) {
    return NextResponse.json({ ok: false, error: "Invalid or unsupported WordSense field." }, { status: 400 });
  }
  try {
    if (body.field === "sentenceIds") {
      if (typeof body.deleteOrphanedSentences !== "boolean") {
        return NextResponse.json({ ok: false, error: "The sentence deletion option must be true or false." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        preview: await previewScopedSentenceLinkMaintenance({
          scope: body.scope,
          deleteOrphanedSentences: body.deleteOrphanedSentences,
        }),
      });
    }
    return NextResponse.json({ ok: true, preview: await previewWordFieldSelection(body.field) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: error instanceof ScopeValidationError ? 400 : 409 },
    );
  }
}
