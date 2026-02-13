import "server-only";

import { NextResponse } from "next/server";

import { listWordFieldVoiceDuplicateGroups } from "@/lib/words/wordFieldVoiceDuplicates.server";

export const runtime = "nodejs";

export async function GET() {
  const groups = listWordFieldVoiceDuplicateGroups();
  const duplicateFiles = groups.reduce((sum, g) => sum + g.duplicates.length, 0);
  return NextResponse.json({ ok: true, groups, duplicateFiles });
}

