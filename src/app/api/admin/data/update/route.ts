import { NextResponse } from "next/server";
import { getDelegate, getPrimaryKey } from "../_shared";

type Body = { model: string; id: unknown; data: Record<string, unknown> };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  const delegate = getDelegate(body.model) as unknown as {
    update: (args: Record<string, unknown>) => Promise<unknown>;
  };
  const pk = getPrimaryKey(body.model);
  const row = await delegate.update({ where: { [pk]: body.id }, data: body.data ?? {} });
  return NextResponse.json({ row });
}
