import { NextResponse } from "next/server";

import {
  PersianWordLinksChangedError,
  PersianWordNotFoundError,
  unlinkPersianWord,
} from "@/lib/words/unlinkPersianWord.server";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function positiveIdArray(value: unknown) {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is number => Number.isSafeInteger(item) && item > 0);
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return ids;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid PersianWord id." }, { status: 400 });

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const expectedPrimaryWordSenseIds = positiveIdArray(body?.expectedPrimaryWordSenseIds);
    const expectedSecondaryWordSenseIds = positiveIdArray(body?.expectedSecondaryWordSenseIds);
    if (!expectedPrimaryWordSenseIds || !expectedSecondaryWordSenseIds) {
      return NextResponse.json({ ok: false, error: "Expected primary and secondary WordSense IDs are required." }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      result: await unlinkPersianWord({
        persianWordId: id,
        expectedPrimaryWordSenseIds,
        expectedSecondaryWordSenseIds,
      }),
    });
  } catch (error) {
    if (error instanceof PersianWordNotFoundError) {
      return NextResponse.json({ ok: false, error: "PersianWord not found." }, { status: 404 });
    }
    if (error instanceof PersianWordLinksChangedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not unlink PersianWord." },
      { status: 500 },
    );
  }
}
