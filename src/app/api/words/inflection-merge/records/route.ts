import { NextResponse } from "next/server";

import {
  loadWordSenseInflectionMergeGroups,
  parseInflectionMergeOutput,
} from "@/lib/words/wordSenseInflectionMerge.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const output = parseInflectionMergeOutput(body?.output);
    return NextResponse.json({
      ok: true,
      output,
      ...(await loadWordSenseInflectionMergeGroups(output)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
