import { NextResponse } from "next/server";

import { deletePersianWordAudio } from "@/lib/persian/persianWordAudio.server";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await deletePersianWordAudio(id)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not delete audio." }, { status: 500 });
  }
}
