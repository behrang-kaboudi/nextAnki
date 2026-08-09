import "server-only";

import { NextResponse } from "next/server";

import {
  countCustomExtractionPendingWork,
} from "@/lib/word-extraction/customExtraction.server";
import {
  CUSTOM_EXTRACTION_INPUT_FIELDS,
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
} from "@/lib/word-extraction/customExtractionFields";
export const runtime = "nodejs";

export async function GET() {
  try {
    const fields = [...new Set([
      ...CUSTOM_EXTRACTION_INPUT_FIELDS.map((field) => field.key),
      ...CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => field.key),
    ])];
    const values: Array<readonly [string, number]> = [];
    for (const field of fields) {
      const count = await countCustomExtractionPendingWork(field);
      values.push([field, count] as const);
    }
    return NextResponse.json({ ok: true, counts: Object.fromEntries(values) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
