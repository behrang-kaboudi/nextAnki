import { NextResponse } from "next/server";
import { getDelegate, getPrimaryKey } from "../_shared";

type Body = { model: string; ids: unknown[] };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  const delegate = getDelegate(body.model) as unknown as {
    deleteMany: (args: Record<string, unknown>) => Promise<{ count?: number }>;
  };
  const pk = getPrimaryKey(body.model);
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const res = await delegate.deleteMany({ where: { [pk]: { in: ids } } });
  return NextResponse.json({ ok: true, deletedCount: res.count ?? 0 });
}
