import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/apiAuth";
import {
  normalizeAnkiStructureConfig,
  validateAnkiStructureConfig,
} from "@/lib/anki/structureSettings";
import {
  getAnkiStructureSettings,
  resetAnkiStructureSettings,
  saveAnkiStructureSettings,
} from "@/lib/anki/structureSettingsRepo";

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });

  try {
    return NextResponse.json({ ok: true, ...(await getAnkiStructureSettings()) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });

  try {
    const body = (await request.json()) as { config?: unknown };
    const config = normalizeAnkiStructureConfig(body.config);
    const errors = validateAnkiStructureConfig(config);
    if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await saveAnkiStructureSettings(config)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });

  try {
    return NextResponse.json({ ok: true, ...(await resetAnkiStructureSettings()) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
