import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type InputItem = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa?: string | null;
};

function parseIntSafe(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function parseId(value: unknown): number | null {
  const id = parseIntSafe(value);
  return id !== null && id > 0 ? id : null;
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s ? s : "";
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawItems = Array.isArray(body)
      ? (body as unknown[])
      : body && typeof body === "object" && Array.isArray((body as Record<string, unknown>).items)
        ? ((body as Record<string, unknown>).items as unknown[])
        : null;

    if (!rawItems) return NextResponse.json({ error: "Body must be a JSON array" }, { status: 400 });

    const items: InputItem[] = [];
    const rejected: Array<{ item: unknown; reason: string }> = [];
    for (const item of rawItems) {
      if (!item || typeof item !== "object") {
        rejected.push({ item, reason: "Expected object" });
        continue;
      }
      const rec = item as Record<string, unknown>;
      const id = parseId(rec.id);
      if (id === null) {
        rejected.push({ item, reason: "Invalid id" });
        continue;
      }
      const sentence_en = typeof rec.sentence_en === "string" ? rec.sentence_en.trim() : "";
      if (!sentence_en) {
        rejected.push({ item, reason: "sentence_en is required" });
        continue;
      }
      const sentence_en_meaning_fa = normalizeOptionalString(rec.sentence_en_meaning_fa);
      if (sentence_en_meaning_fa === undefined) {
        rejected.push({ item, reason: "sentence_en_meaning_fa must be string or null" });
        continue;
      }

      items.push({ id, sentence_en, sentence_en_meaning_fa });
    }

    const byId = new Map<number, Omit<InputItem, "id">>();
    for (const it of items) byId.set(it.id, { sentence_en: it.sentence_en, sentence_en_meaning_fa: it.sentence_en_meaning_fa });
    const ids = Array.from(byId.keys());
    if (ids.length === 0) return NextResponse.json({ error: "No valid rows found" }, { status: 400 });

    const existing = await prisma.word.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((r) => r.id));
    const missingIds = ids.filter((id) => !existingIds.has(id));

    // Use raw SQL so this endpoint keeps working even if the dev Prisma Client
    // is temporarily out-of-date after schema changes (until server restart).
    const existingIdList = ids.filter((id) => existingIds.has(id));
    const partsSentenceEn = existingIdList.map((id) =>
      Prisma.sql`WHEN ${id} THEN ${byId.get(id)?.sentence_en ?? ""}`
    );
    const partsSentenceFa = existingIdList.map((id) =>
      Prisma.sql`WHEN ${id} THEN ${byId.get(id)?.sentence_en_meaning_fa ?? null}`
    );
    const updated: number =
      existingIdList.length === 0
        ? 0
        : await prisma.$executeRaw`
            UPDATE Word
            SET
              sentence_en = CASE id
                ${Prisma.join(partsSentenceEn, " ")}
                ELSE sentence_en
              END,
              sentence_en_meaning_fa = CASE id
                ${Prisma.join(partsSentenceFa, " ")}
                ELSE sentence_en_meaning_fa
              END
            WHERE id IN (${Prisma.join(existingIdList)});
          `;

    return NextResponse.json({
      requested: ids.length,
      updated: typeof updated === "number" ? updated : 0,
      missing: missingIds.length,
      missingIds,
      rejectedCount: rejected.length,
      rejected,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
