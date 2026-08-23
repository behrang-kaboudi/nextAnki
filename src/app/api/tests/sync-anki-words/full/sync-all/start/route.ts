import { NextResponse } from "next/server";

import { startFullSyncAllIfNeeded } from "@/lib/anki/fullSyncAllJob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { snapshotId?: unknown };
  const snapshotId =
    typeof body.snapshotId === "string" && body.snapshotId.trim()
      ? body.snapshotId.trim()
      : undefined;
  const status = startFullSyncAllIfNeeded({ snapshotId });
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}
