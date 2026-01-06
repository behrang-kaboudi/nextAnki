import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const promptPath = path.join(
  process.cwd(),
  "src/prompts/others/physical-object-vocabulary.md",
);

export async function GET() {
  try {
    const text = fs.readFileSync(promptPath, "utf8");
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to read prompt file: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = (body && typeof body === "object" ? (body as { text?: unknown }).text : null) as
    | unknown
    | null;
  if (typeof text !== "string") {
    return NextResponse.json({ error: "Expected { text: string }" }, { status: 400 });
  }

  try {
    fs.writeFileSync(promptPath, text, "utf8");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to write prompt file: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

