import { NextResponse } from "next/server";

import {
  applyWordSenseConceptMerge,
  ConceptMergePersianWordResolutionRequiredError,
  parseManualConceptMergeEntries,
  parseManualMergeOutput,
  prepareManualWordSenseConceptMerge,
} from "@/lib/words/wordSenseConceptMerge.server";
import { parsePersianWordResolutionSelections } from "@/lib/words/persianWordResolution.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const entries = parseManualConceptMergeEntries(body?.entries);
    const output = parseManualMergeOutput(body?.output);
    if (!output.length) throw new Error("An empty manual response has no merge to apply.");
    const prepared = await prepareManualWordSenseConceptMerge(entries);
    const selections = parsePersianWordResolutionSelections(body?.persian_word_resolutions);
    const result = await applyWordSenseConceptMerge(
      [prepared.sourceGroup],
      output,
      selections,
      [],
      [],
      [],
      { manual: true },
    );
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
