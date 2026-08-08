import "server-only";

import type { AiModel } from "@prisma/client";

import { normalizeBaseUrl, normalizeModelSettings, type LocalChatMessage } from "./localModels";

type LmStudioModelList = {
  data?: Array<{ id?: unknown }>;
  error?: { message?: unknown };
};

type LmStudioChatResponse = {
  choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
  error?: { message?: unknown };
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.trim() || `LM Studio returned HTTP ${response.status}.`);
  }
}

export async function discoverLmStudioModels(baseUrl: string) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await parseResponse<LmStudioModelList>(response);
  if (!response.ok) throw new Error(String(body.error?.message || `LM Studio returned HTTP ${response.status}.`));
  return (body.data ?? [])
    .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function chatWithLmStudio(model: AiModel, messages: LocalChatMessage[]) {
  const settings = normalizeModelSettings(model.settings);
  const requestMessages: LocalChatMessage[] = model.systemPrompt
    ? [{ role: "system", content: model.systemPrompt }, ...messages.filter((message) => message.role !== "system")]
    : messages;

  const response = await fetch(`${normalizeBaseUrl(model.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      ...settings,
      model: model.modelIdentifier,
      messages: requestMessages,
      stream: false,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });
  const body = await parseResponse<LmStudioChatResponse>(response);
  if (!response.ok) throw new Error(String(body.error?.message || `LM Studio returned HTTP ${response.status}.`));
  const output = body.choices?.[0]?.message?.content;
  if (typeof output !== "string") throw new Error("LM Studio returned no assistant message.");
  return {
    output,
    finishReason: typeof body.choices?.[0]?.finish_reason === "string" ? body.choices[0].finish_reason : null,
    usage: {
      promptTokens: Number(body.usage?.prompt_tokens) || 0,
      completionTokens: Number(body.usage?.completion_tokens) || 0,
      totalTokens: Number(body.usage?.total_tokens) || 0,
    },
  };
}
