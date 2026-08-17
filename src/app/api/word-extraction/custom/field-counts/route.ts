import "server-only";

import { NextResponse } from "next/server";

import {
  countCustomExtractionPendingWork,
  getCustomExtractionPendingSummary,
} from "@/lib/word-extraction/customExtraction.server";
import {
  CUSTOM_EXTRACTION_INPUT_FIELDS,
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
} from "@/lib/word-extraction/customExtractionFields";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const requestedFields = [...new Set(
      new URL(request.url).searchParams
        .get("fields")
        ?.split(",")
        .map((field) => field.trim())
        .filter((field): field is (typeof CUSTOM_EXTRACTION_OUTPUT_FIELDS)[number]["key"] =>
          CUSTOM_EXTRACTION_OUTPUT_FIELDS.some((candidate) => candidate.key === field),
        ) ?? [],
    )];
    if (requestedFields.length) {
      const summary = await getCustomExtractionPendingSummary(requestedFields);
      return NextResponse.json({
        ok: true,
        counts: summary.fieldCounts,
        selectedTotal: summary.total,
      });
    }

    const fields = [...new Set([
      ...CUSTOM_EXTRACTION_INPUT_FIELDS.map((field) => field.key),
      ...CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => field.key),
    ])];
    const values = await Promise.all(
      fields.map(async (field) => [field, await countCustomExtractionPendingWork(field)] as const),
    );
    return NextResponse.json({
      ok: true,
      counts: Object.fromEntries(values),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
