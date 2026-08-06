import { NextResponse } from "next/server";
import { updateManyWords } from "@/lib/words/wordRepo";
export const runtime = "nodejs";
export async function POST() {
  const result = await updateManyWords({
    where: { meanings_confirmed: true },
    data: { meanings_confirmed: false },
  });
  return NextResponse.json({ ok: true, reset: result.count });
}
