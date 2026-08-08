import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireApiRole } from "@/lib/auth/apiAuth";
import { createAiModel, listAiModels } from "@/lib/ai/localModelRepo";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  try {
    return NextResponse.json({ ok: true, models: await listAiModels() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load AI models." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const model = await createAiModel({
      name: body.name,
      modelIdentifier: body.modelIdentifier,
      baseUrl: body.baseUrl,
      systemPrompt: body.systemPrompt,
      settings: body.settings,
      isEnabled: body.isEnabled,
      isDefault: body.isDefault,
    });
    return NextResponse.json({ ok: true, model }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Model name must be unique." }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not add AI model." },
      { status: 400 },
    );
  }
}
