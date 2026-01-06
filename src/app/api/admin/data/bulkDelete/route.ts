import { NextResponse } from "next/server";
import { getDelegate, getPrimaryKey } from "../_shared";

type Body = { model: string; ids: unknown[] };

function normalizeIds(ids: unknown[]) {
  const out: Array<string | number> = [];
  for (const raw of ids) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out.push(raw);
      continue;
    }
    if (typeof raw === "string") {
      const s = raw.trim();
      if (!s) continue;
      if (/^-?\d+$/.test(s)) {
        const n = Number(s);
        if (Number.isFinite(n)) out.push(n);
      } else {
        out.push(s);
      }
      continue;
    }
  }
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  const delegate = getDelegate(body.model) as unknown as {
    deleteMany: (args: Record<string, unknown>) => Promise<{ count?: number }>;
  };
  const pk = getPrimaryKey(body.model);
  const ids = normalizeIds(Array.isArray(body.ids) ? body.ids : []);
  if (ids.length === 0) return NextResponse.json({ ok: true, deletedCount: 0 });

  const res = await delegate.deleteMany({ where: { [pk]: { in: ids } } });
  return NextResponse.json({ ok: true, deletedCount: res.count ?? 0 });
}
