import "server-only";

import { NextResponse } from "next/server";

import {
  addWordStudyId,
  getWordStudyList,
  removeWordStudyIds,
} from "@/lib/study/wordStudyList.server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ user: string }> };

function positiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { user } = await params;
    return NextResponse.json({ ok: true, user, ...(await getWordStudyList(user)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { user } = await params;
    const body = (await request.json().catch(() => null)) as { wordSenseId?: unknown } | null;
    const wordSenseId = positiveInteger(body?.wordSenseId);
    if (!wordSenseId) {
      return NextResponse.json(
        { ok: false, error: "wordSenseId must be a positive integer." },
        { status: 400 },
      );
    }
    const ids = await addWordStudyId(user, wordSenseId);
    return NextResponse.json({ ok: true, user, wordSenseId, ids });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.endsWith("not found.") ? 404 : 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { user } = await params;
    const body = (await request.json().catch(() => null)) as { wordSenseIds?: unknown } | null;
    if (!Array.isArray(body?.wordSenseIds)) {
      return NextResponse.json(
        { ok: false, error: "wordSenseIds must be an array of positive integers." },
        { status: 400 },
      );
    }
    const wordSenseIds = body.wordSenseIds.map(positiveInteger);
    if (wordSenseIds.some((id) => id === null)) {
      return NextResponse.json(
        { ok: false, error: "wordSenseIds must be an array of positive integers." },
        { status: 400 },
      );
    }
    const ids = await removeWordStudyIds(user, wordSenseIds as number[]);
    return NextResponse.json({ ok: true, user, removedWordSenseIds: wordSenseIds, ids });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
