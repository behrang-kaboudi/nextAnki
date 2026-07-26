import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Template = { Front: string; Back: string };

function parseTemplates(value: unknown): Record<string, Template> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const templates: Record<string, Template> = {};
  for (const [name, template] of Object.entries(value)) {
    if (!name || !template || typeof template !== "object" || Array.isArray(template)) return null;
    const { Front, Back } = template as Record<string, unknown>;
    if (typeof Front !== "string" || typeof Back !== "string") return null;
    templates[name] = { Front, Back };
  }

  return Object.keys(templates).length ? templates : null;
}

function asTemplateLiteral(value: string): string {
  return `\`${value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${")}\``;
}

function createSource(templates: Record<string, Template>): string {
  const entries = Object.entries(templates).map(
    ([name, template]) =>
      `  ${JSON.stringify(name)}: {\n` +
      `    Front: ${asTemplateLiteral(template.Front)},\n` +
      `    Back: ${asTemplateLiteral(template.Back)},\n` +
      "  },",
  );

  return `export const wordNoteTemplates = {\n${entries.join("\n")}\n} as const;\n`;
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Template export is only available in development." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const templates = parseTemplates((body as { templates?: unknown } | null)?.templates);
  if (!templates) {
    return NextResponse.json({ ok: false, error: "Expected a non-empty templates object." }, { status: 400 });
  }

  const relativePath = "src/lib/anki/deck/notes/wordNoteTemplates.ts";
  const targetPath = path.join(process.cwd(), relativePath);
  const temporaryPath = `${targetPath}.tmp`;

  try {
    await writeFile(temporaryPath, createSource(templates), "utf8");
    await rename(temporaryPath, targetPath);
    return NextResponse.json({ ok: true, path: relativePath, templateNames: Object.keys(templates) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
