import { NextResponse } from "next/server";

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type PromptFile = {
  path: string;
  bytes: number;
};

async function listFilesRecursive(rootDir: string, dir: string): Promise<PromptFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: PromptFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursive(rootDir, abs)));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(md|txt)$/i.test(entry.name)) continue;
    const s = await stat(abs);
    if (s.size === 0) continue;
    const text = await readFile(abs, "utf8");
    if (!text.trim()) continue;
    const rel = path.relative(rootDir, abs).replaceAll(path.sep, "/");
    const displayPath = rel.startsWith("src/prompts/word-extraction/")
      ? rel.slice("src/prompts/word-extraction/".length)
      : rel;
    results.push({ path: displayPath, bytes: s.size });
  }

  return results;
}

export async function GET() {
  try {
    const root = process.cwd();
    const promptsDir = path.join(root, "src", "prompts", "word-extraction");
    const files = await listFilesRecursive(root, promptsDir);
    files.sort((a, b) => a.path.localeCompare(b.path));
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
