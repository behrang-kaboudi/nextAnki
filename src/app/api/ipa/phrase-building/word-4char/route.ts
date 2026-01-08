import "server-only";

import { NextResponse } from "next/server";

import { findMatchesForAll4CharWords } from "@/lib/ipa/selectKey4";

export const runtime = "nodejs";

export async function GET() {
  const data = await findMatchesForAll4CharWords();
  return NextResponse.json(data);
}

