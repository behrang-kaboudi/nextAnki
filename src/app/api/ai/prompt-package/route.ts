import { NextResponse } from "next/server";

import {
  buildWordExtractionPromptPackage,
  PromptPackageInputError,
} from "@/lib/word-extraction/promptPackage.server";

export const runtime = "nodejs";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    if (!isObject(body)) {
      return NextResponse.json(
        { ok: false, error: "Request body must be an object." },
        { status: 400 },
      );
    }

    const promptPackage = await buildWordExtractionPromptPackage(body.fields);
    return NextResponse.json({ ok: true, ...promptPackage });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: error instanceof PromptPackageInputError ? 400 : 500 },
    );
  }
}
