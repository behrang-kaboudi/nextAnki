import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { updateAiModel, deleteAiModel } from "@/lib/ai/localModelRepo";
import { requireApiRole } from "@/lib/auth/apiAuth";

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid model id." }, { status: 400 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const model = await updateAiModel(id, {
      name: body.name,
      modelIdentifier: body.modelIdentifier,
      baseUrl: body.baseUrl,
      systemPrompt: body.systemPrompt,
      settings: body.settings,
      isEnabled: body.isEnabled,
      isDefault: body.isDefault,
    });
    return NextResponse.json({ ok: true, model });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: false, error: "AI model not found." }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Model name must be unique." }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update AI model." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid model id." }, { status: 400 });
  try {
    await deleteAiModel(id);
    return NextResponse.json({ ok: true, deletedId: id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: false, error: "AI model not found." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not delete AI model." },
      { status: 500 },
    );
  }
}
