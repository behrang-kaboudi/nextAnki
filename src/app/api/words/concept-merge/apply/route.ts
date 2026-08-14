import { NextResponse } from "next/server";

import {
  applyWordSenseConceptMerge,
  ConceptMergePersianWordResolutionRequiredError,
  parseMergeOutput,
} from "@/lib/words/wordSenseConceptMerge.server";
import { parsePersianWordResolutionSelections } from "@/lib/words/persianWordResolution.server";

export const runtime = "nodejs";

function parseGroups(value: unknown): number[][] | null {
  if (!Array.isArray(value)) return null;
  const groups = value as unknown[];
  if (groups.some((group) =>
    !Array.isArray(group) || group.length < 2 || group.some((id) =>
      typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0,
    ),
  )) return null;
  return groups as number[][];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sourceGroups = parseGroups(body?.sourceGroups);
  if (!sourceGroups) {
    return NextResponse.json(
      { ok: false, error: "sourceGroups must contain arrays of positive record ids." },
      { status: 400 },
    );
  }
  try {
    const output = parseMergeOutput(body?.output);
    const selections = parsePersianWordResolutionSelections(body?.persian_word_resolutions);
    const result = await applyWordSenseConceptMerge(sourceGroups, output, selections);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ConceptMergePersianWordResolutionRequiredError) {
      return NextResponse.json(
        {
          ok: false,
          code: "PERSIAN_WORD_RESOLUTION_REQUIRED",
          error: error.message,
          ambiguities: error.ambiguities,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
