import { NextResponse } from "next/server";
import { getDelegate } from "../_shared";

type Body = { model: string; data: Record<string, unknown> };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  const delegate = getDelegate(body.model) as unknown as {
    create: (args: Record<string, unknown>) => Promise<unknown>;
  };
  const row = await delegate.create({ data: body.data ?? {} });
  return NextResponse.json({ row });
}
