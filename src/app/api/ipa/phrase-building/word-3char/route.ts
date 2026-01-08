import "server-only";

import { NextResponse } from "next/server";

import { findMatchesForAll3CharWords } from "@/lib/ipa/selectKey3";

export const runtime = "nodejs";

export async function GET() {
  const data = await findMatchesForAll3CharWords();
  return NextResponse.json(data);
}

