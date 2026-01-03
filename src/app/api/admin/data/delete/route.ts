import { NextResponse } from "next/server";
import { getDelegate, getPrimaryKey } from "../_shared";

type Body = { model: string; id: unknown };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  const delegate = getDelegate(body.model) as unknown as {
    delete: (args: Record<string, unknown>) => Promise<unknown>;
  };
  const pk = getPrimaryKey(body.model);
  await delegate.delete({ where: { [pk]: body.id } });
  return NextResponse.json({ ok: true });
}
