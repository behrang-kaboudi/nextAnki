import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getDelegate } from "../_shared";

function ensureModel(model: string) {
  const ok = Prisma.dmmf.datamodel.models.some((m) => m.name === model);
  if (!ok) throw new Error(`Unknown model: ${model}`);
}

function getAllowedScalarEnumFields(model: string) {
  const meta = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  const fields = meta?.fields ?? [];
  return new Set(
    fields
      .filter((f) => (f.kind === "scalar" || f.kind === "enum") && !f.isList)
      .map((f) => f.name),
  );
}

export const runtime = "nodejs";

type Body = {
  model: string;
  keyFields: string[];
  updateFields: string[];
  items: unknown;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const model = (body?.model ?? "").trim();
    if (!model) return NextResponse.json({ error: "model is required" }, { status: 400 });
    ensureModel(model);

    const allowed = getAllowedScalarEnumFields(model);
    const keyFields = Array.from(new Set((body.keyFields ?? []).map((s) => String(s).trim()).filter(Boolean)));
    const updateFields = Array.from(new Set((body.updateFields ?? []).map((s) => String(s).trim()).filter(Boolean)));

    if (!keyFields.length) return NextResponse.json({ error: "keyFields is required" }, { status: 400 });
    if (!updateFields.length) return NextResponse.json({ error: "updateFields is required" }, { status: 400 });

    for (const k of keyFields) {
      if (!allowed.has(k)) return NextResponse.json({ error: `Invalid key field: ${k}` }, { status: 400 });
    }
    for (const k of updateFields) {
      if (!allowed.has(k)) return NextResponse.json({ error: `Invalid update field: ${k}` }, { status: 400 });
      if (keyFields.includes(k)) return NextResponse.json({ error: `Field cannot be both key and update: ${k}` }, { status: 400 });
    }

    const items = Array.isArray(body.items) ? body.items : body.items ? [body.items] : [];
    if (!items.length) return NextResponse.json({ error: "items must be a non-empty array (or an object)" }, { status: 400 });

    const delegate = getDelegate(model) as unknown as {
      updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
    };

    let processed = 0;
    let updated = 0;
    let notFound = 0;
    let multipleMatched = 0;
    let skippedMissingKeys = 0;
    let skippedNoUpdateFields = 0;

    for (const raw of items) {
      processed += 1;
      if (!raw || typeof raw !== "object") {
        skippedMissingKeys += 1;
        continue;
      }
      const obj = raw as Record<string, unknown>;

      const where: Record<string, unknown> = {};
      let hasAllKeys = true;
      for (const k of keyFields) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) {
          hasAllKeys = false;
          break;
        }
        where[k] = obj[k] ?? null;
      }
      if (!hasAllKeys) {
        skippedMissingKeys += 1;
        continue;
      }

      const data: Record<string, unknown> = {};
      for (const f of updateFields) {
        if (!Object.prototype.hasOwnProperty.call(obj, f)) continue;
        data[f] = obj[f];
      }
      if (!Object.keys(data).length) {
        skippedNoUpdateFields += 1;
        continue;
      }

      const res = await delegate.updateMany({ where, data });
      if (res.count === 0) notFound += 1;
      else if (res.count > 1) {
        multipleMatched += 1;
        updated += res.count;
      } else {
        updated += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      model,
      keyFields,
      updateFields,
      processed,
      updated,
      notFound,
      multipleMatched,
      skippedMissingKeys,
      skippedNoUpdateFields,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

