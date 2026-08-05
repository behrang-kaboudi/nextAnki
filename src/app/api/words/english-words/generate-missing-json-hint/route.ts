import { NextResponse } from "next/server";

import { getEnglishWordJsonHintJobStatus, startEnglishWordJsonHintJobIfNeeded } from "@/lib/english/englishWordJsonHintGenerateJob";

export const runtime = "nodejs";
export async function POST() { return NextResponse.json({ ok: true, status: startEnglishWordJsonHintJobIfNeeded() }); }
export async function GET() { return NextResponse.json({ ok: true, status: getEnglishWordJsonHintJobStatus() }); }
