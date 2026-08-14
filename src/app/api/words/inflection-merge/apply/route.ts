import "server-only";

import { NextResponse } from "next/server";

import {
  applyWordSenseInflectionMerge,
  parseInflectionMergeOutput,
  type InflectionSourceFingerprint,
} from "@/lib/words/wordSenseInflectionMerge.server";

export const runtime = "nodejs";

function parseSourceGroups(value: unknown): InflectionSourceFingerprint[] | null {
  if (!Array.isArray(value) || !value.length) return null;
  const groups = value as Array<Record<string, unknown>>;
  if (groups.some((group) =>
    !group || typeof group !== "object" || typeof group.groupKey !== "string" || typeof group.pos !== "string" ||
    !Array.isArray(group.englishWordIds) || !Array.isArray(group.wordIds) ||
    group.englishWordIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) ||
    group.wordIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
  )) return null;
  return groups as unknown as InflectionSourceFingerprint[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sourceGroups = parseSourceGroups(body?.sourceGroups);
  if (!sourceGroups) {
    return NextResponse.json({ ok: false, error: "sourceGroups has an invalid shape." }, { status: 400 });
  }
  try {
    const output = parseInflectionMergeOutput(body?.output);
    return NextResponse.json({ ok: true, ...(await applyWordSenseInflectionMerge(sourceGroups, output)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
