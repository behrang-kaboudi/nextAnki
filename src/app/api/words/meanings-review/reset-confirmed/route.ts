import { NextResponse } from "next/server";
import { updateManyWordSenses } from "@/lib/words/wordSenseRepo";
export const runtime = "nodejs";
export async function POST() {
  const result = await updateManyWordSenses({
    where: { meanings_confirmed: true },
    data: { meanings_confirmed: false },
  });
  return NextResponse.json({ ok: true, reset: result.count });
}
