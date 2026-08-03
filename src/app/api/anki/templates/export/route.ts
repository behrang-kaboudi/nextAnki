import { NextResponse } from "next/server";

import { getAnkiStructureSettings, saveAnkiStructureSettings } from "@/lib/anki/structureSettingsRepo";

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

  try {
    const structureSettings = await getAnkiStructureSettings();
    const existingByName = new Map(
      structureSettings.config.noteType.cardTypes.map((cardType) => [cardType.name, cardType]),
    );
    const config = {
      ...structureSettings.config,
      noteType: {
        ...structureSettings.config.noteType,
        cardTypes: Object.entries(templates).map(([name, template], index) => {
          const existing = existingByName.get(name);
          return {
            id: existing?.id ?? `card-imported-${index + 1}`,
            name,
            deckIds: existing?.deckIds ?? [],
            front: template.Front,
            back: template.Back,
          };
        }),
      },
    };
    const saved = await saveAnkiStructureSettings(config);
    return NextResponse.json({ ok: true, templateNames: Object.keys(templates), version: saved.version });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
