import "server-only";

import { NextResponse } from "next/server";

import {
  deleteWordFieldVoiceDuplicates,
  listWordFieldVoiceDuplicateGroups,
} from "@/lib/words/wordFieldVoiceDuplicates.server";

export const runtime = "nodejs";

export async function POST() {
  const before = listWordFieldVoiceDuplicateGroups();
  const beforeDuplicateFiles = before.reduce((sum, g) => sum + g.duplicates.length, 0);

  const res = await deleteWordFieldVoiceDuplicates();

  const after = listWordFieldVoiceDuplicateGroups();
  const afterDuplicateFiles = after.reduce((sum, g) => sum + g.duplicates.length, 0);

  return NextResponse.json({
    ok: true,
    deleted: res.deleted,
    failed: res.failed,
    deletedBytes: res.deletedBytes,
    before: { groups: before.length, duplicateFiles: beforeDuplicateFiles },
    after: { groups: after.length, duplicateFiles: afterDuplicateFiles },
  });
}

