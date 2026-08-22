import "server-only";

import { NextResponse } from "next/server";

import { addWordStudyId } from "@/lib/study/wordStudyList.server";
import {
  createWordSenseFromIntake,
  parseWordSenseIntakeInput,
} from "@/lib/words/createWordSenseFromIntake.server";
import {
  updateWordSenseFromIntake,
  WordSenseIntakeUpdateConflictError,
  WordSenseIntakeUpdateNotFoundError,
} from "@/lib/words/updateWordSenseFromIntake.server";
import { parseWordSenseIntakeUpdateInput } from "@/lib/words/wordSenseIntakeUpdate";

export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json({ ok: false, error: "Request body must be an object." }, { status: 400 });
    }
    const studyNow = body.study_now === undefined ? true : body.study_now;
    if (typeof studyNow !== "boolean") {
      return NextResponse.json({ ok: false, error: "study_now must be a boolean." }, { status: 400 });
    }
    const studyUser = typeof body.study_user === "string" && body.study_user.trim()
      ? body.study_user.trim()
      : "behrang";
    const sense = parseWordSenseIntakeInput(body.sense);
    const result = await createWordSenseFromIntake(sense);
    const studyIds = studyNow ? await addWordStudyId(studyUser, result.id) : null;

    return NextResponse.json(
      {
        ok: true,
        action: result.action,
        item: {
          id: result.id,
          anki_link_id: result.anki_link_id,
          ...sense,
        },
        study: {
          user: studyUser,
          requested_now: studyNow,
          listed: studyNow,
          ...(studyIds ? { ids: studyIds } : {}),
        },
      },
      { status: result.action === "created" ? 201 : 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const input = parseWordSenseIntakeUpdateInput(body);
    const result = await updateWordSenseFromIntake(input);
    return NextResponse.json({
      ok: true,
      ...result,
      changes: input.changes,
    });
  } catch (error) {
    if (error instanceof WordSenseIntakeUpdateNotFoundError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    if (error instanceof WordSenseIntakeUpdateConflictError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
