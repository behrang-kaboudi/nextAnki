import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { parsePromptBatchSize, selectPromptBatch } from "@/lib/words/promptBatch";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const batchSize = parsePromptBatchSize(
    Number(params.get("batchSize") ?? params.get("limit") ?? "50"),
    50,
  );
  if (batchSize === null) {
    return NextResponse.json({ ok: false, error: "Invalid batch size." }, { status: 400 });
  }
  const where = {
    OR: [{ phonetic_us: null }, { phonetic_us: "" }],
  };
  const [eligible, totalUnconfirmed] = await Promise.all([
    prisma.englishWord.findMany({ where, orderBy: { id: "asc" }, select: { id: true, base_form: true } }),
    prisma.englishWord.count({ where }),
  ]);
  const items = selectPromptBatch(eligible, batchSize);
  return NextResponse.json({ ok: true, items, totalUnconfirmed });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (!ids.length || ids.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) ||
      new Set(ids).size !== ids.length) {
    return NextResponse.json({ ok: false, error: "Body must include unique positive ids." }, { status: 400 });
  }
  const records = await prisma.englishWord.findMany({
    where: { id: { in: ids }, OR: [{ phonetic_us: null }, { phonetic_us: "" }] },
    select: { id: true, base_form: true },
  });
  if (records.length !== ids.length) {
    return NextResponse.json(
      { ok: false, error: "One or more response ids no longer exist or already have phonetic_us." },
      { status: 400 },
    );
  }
  const byId = new Map(records.map((item) => [item.id, item]));
  return NextResponse.json({ ok: true, items: ids.map((id) => byId.get(id)!) });
}
