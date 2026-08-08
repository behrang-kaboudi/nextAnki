import { NextResponse } from "next/server";

import { chatWithLmStudio } from "@/lib/ai/lmStudio";
import { normalizeChatMessages } from "@/lib/ai/localModels";
import { requireApiAuth } from "@/lib/auth/apiAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const modelId = Number(body.modelId);
    if (!Number.isSafeInteger(modelId) || modelId <= 0) {
      return NextResponse.json({ ok: false, error: "A valid modelId is required." }, { status: 400 });
    }
    const model = await prisma.aiModel.findUnique({ where: { id: modelId } });
    if (!model || !model.isEnabled) {
      return NextResponse.json({ ok: false, error: "The selected AI model is unavailable or disabled." }, { status: 404 });
    }
    const result = await chatWithLmStudio(model, normalizeChatMessages(body.messages));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local chat failed.";
    const friendly = message.includes("fetch failed") || message.includes("ECONNREFUSED")
      ? "Could not connect to LM Studio. Make sure its local server is running."
      : message;
    const status = message.includes("Messages must") || message.includes("Message ") ? 400 : 502;
    return NextResponse.json({ ok: false, error: friendly }, { status });
  }
}
