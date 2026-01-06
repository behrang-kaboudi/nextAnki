import { NextResponse } from "next/server";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type LatestFile = {
  filename: string;
  version: number;
};

function pickLatestVersionFile(
  filenames: string[],
  candidates: { prefix: string; suffix?: string }[],
): LatestFile | null {
  const matches: LatestFile[] = [];

  for (const filename of filenames) {
    for (const { prefix, suffix } of candidates) {
      if (!filename.startsWith(prefix)) continue;
      if (suffix && !filename.endsWith(suffix)) continue;

      const match = filename.match(/V(\d+)\.md$/i);
      if (!match) continue;

      matches.push({ filename, version: Number(match[1]) });
    }
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => b.version - a.version);
  return matches[0];
}

export async function GET() {
  const baseDir = path.join(
    process.cwd(),
    "src",
    "prompts",
    "word-extraction",
    "base",
  );

  const filenames = await readdir(baseDir);

  const latestRules =
    pickLatestVersionFile(filenames, [
      { prefix: "rulseV" },
      { prefix: "rulesV" },
    ]) ?? null;

  const latestGuide =
    pickLatestVersionFile(filenames, [{ prefix: "guideV" }]) ?? null;

  if (!latestRules || !latestGuide) {
    return NextResponse.json(
      {
        error: "Missing prompt files in base folder.",
        details: {
          rules: latestRules?.filename ?? null,
          guide: latestGuide?.filename ?? null,
        },
      },
      { status: 404 },
    );
  }

  const [rulesText, guideText] = await Promise.all([
    readFile(path.join(baseDir, latestRules.filename), "utf8"),
    readFile(path.join(baseDir, latestGuide.filename), "utf8"),
  ]);

  return NextResponse.json({
    rules: {
      filename: latestRules.filename,
      version: latestRules.version,
      content: rulesText,
    },
    guide: {
      filename: latestGuide.filename,
      version: latestGuide.version,
      content: guideText,
    },
  });
}

