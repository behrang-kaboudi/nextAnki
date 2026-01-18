import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/apiAuth";

export async function GET() {
  const res = await requireApiRole("admin");
  if (!res.ok) return NextResponse.json({ message: "Forbidden" }, { status: res.status });
  return NextResponse.json({ ok: true, userId: res.session.user?.id });
}

