import "server-only";

import { NextResponse } from "next/server";

import { findMatchesForAll2CharWords } from "@/lib/ipa/selectKey2";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const maxPrefixesRaw = Number(url.searchParams.get("maxPrefixes") ?? "2000");
  const maxWordsPerPrefixRaw = Number(url.searchParams.get("maxWordsPerPrefix") ?? "10");
  const maxMatchesPerPrefixRaw = Number(url.searchParams.get("maxMatchesPerPrefix") ?? "50");

  const maxPrefixes = Number.isFinite(maxPrefixesRaw) ? maxPrefixesRaw : 2000;
  const maxWordsPerPrefix = Number.isFinite(maxWordsPerPrefixRaw) ? maxWordsPerPrefixRaw : 10;
  const maxMatchesPerPrefix = Number.isFinite(maxMatchesPerPrefixRaw) ? maxMatchesPerPrefixRaw : 50;

  const data = await findMatchesForAll2CharWords({ maxPrefixes, maxWordsPerPrefix, maxMatchesPerPrefix });
  return NextResponse.json(data);
}
