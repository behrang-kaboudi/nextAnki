import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseId(value: string | null) {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix")?.trim() || "";

  const rows = await prisma.ipaKeyword.findMany({
    where: prefix ? { faPlain: { startsWith: prefix } } : undefined,
    orderBy: { faPlain: "asc" },
    select: { id: true, number: true, fa: true, faPlain: true, ipa_fa: true },
  });

  return NextResponse.json({ rows });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = parseId(url.searchParams.get("id"));
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await prisma.ipaKeyword.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
