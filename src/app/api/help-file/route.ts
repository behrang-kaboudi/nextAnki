import { NextResponse } from "next/server";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function isSafeHelpPath(rel: string): boolean {
  if (!rel) return false;
  if (rel.includes("\0")) return false;
  const normalized = rel.replaceAll("\\", "/");
  if (normalized.startsWith("/")) return false;
  if (normalized.includes("..")) return false;

  // This endpoint accepts either:
  // - full: src/helps/...
  // - short: ... (relative to src/helps)
  if (normalized.startsWith("src/helps/")) {
    // ok
  } else {
    if (normalized.includes("src/") || normalized.includes("helps/")) return false;
  }

  if (!/\.md$/i.test(normalized)) return false;
  return true;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rel = String(url.searchParams.get("path") ?? "");
  if (!isSafeHelpPath(rel)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const base = path.join(process.cwd(), "src", "helps");
    const abs = rel.replaceAll("\\", "/").startsWith("src/helps/")
      ? path.join(process.cwd(), rel)
      : path.join(base, rel);
    const text = await readFile(abs, "utf8");
    return NextResponse.json({ path: rel, text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const rel = typeof obj?.path === "string" ? obj.path : "";
  const text = typeof obj?.text === "string" ? obj.text : null;

  if (!isSafeHelpPath(rel)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (text === null) {
    return NextResponse.json({ error: "`text` must be a string" }, { status: 400 });
  }

  try {
    const base = path.join(process.cwd(), "src", "helps");
    const abs = rel.replaceAll("\\", "/").startsWith("src/helps/")
      ? path.join(process.cwd(), rel)
      : path.join(base, rel);
    await writeFile(abs, text, "utf8");
    return NextResponse.json({ ok: true, path: rel });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
