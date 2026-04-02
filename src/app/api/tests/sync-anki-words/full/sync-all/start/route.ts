import { NextResponse } from "next/server";

import { startFullSyncAllIfNeeded } from "@/lib/anki/fullSyncAllJob";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ignoreUpdatedAt?: unknown } | null;
  const status = startFullSyncAllIfNeeded({
    ignoreUpdatedAt: body?.ignoreUpdatedAt === true,
  });
  return NextResponse.json({ ok: true as const, status }, { status: 200 });
}

