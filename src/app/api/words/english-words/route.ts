import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { normalizeEnglishWordText } from "@/lib/english/normalize";
import { normalizeIpaForDb } from "@/lib/ipa/normalize";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function nullableString(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const base_form = normalizeEnglishWordText(typeof body?.text === "string" ? body.text : "");
    const phonetic_us = nullableString(body?.phonetic_us);
    if (!base_form) {
      return NextResponse.json({ ok: false, error: "text must contain at least one English letter." }, { status: 400 });
    }

    const item = await prisma.englishWord.create({
      data: {
        base_form,
        phonetic_us,
        phonetic_us_normalized: phonetic_us ? normalizeIpaForDb(phonetic_us, 2000) || null : null,
        json_hint: nullableString(body?.json_hint),
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "This English base form already exists." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not add EnglishWord." }, { status: 500 });
  }
}
