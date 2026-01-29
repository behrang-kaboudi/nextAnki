import "server-only";

import OpenAI from "openai";

// Setup:
// - Add this to `.env.local` (recommended) or `.env`:
//   OPENAI_API_KEY="PASTE_YOUR_KEY_HERE"

type GptChatParams = {
  itemString: string;
  systemPrompt: string;
  cacheRetention?: "in_memory" | "24h";
  promptCacheKey?: string;
};

export type GptUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    audio_tokens?: number;
  };
  completion_tokens_details?: {
    reasoning_tokens?: number;
    audio_tokens?: number;
    accepted_prediction_tokens?: number;
    rejected_prediction_tokens?: number;
  };
};

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  client = new OpenAI({ apiKey });
  return client;
}

export function checkPrompt(prompt: string): void {
  void prompt;
  // kept for parity with upstream; add hashing/logging here if needed
}

export async function gptChat({
  itemString,
  systemPrompt,
  cacheRetention = "24h",
  promptCacheKey,
}: GptChatParams): Promise<string> {
  checkPrompt(systemPrompt);

  const resp = await getClient().chat.completions.create({
    // Keep same model string as the referenced file; change if your account uses a different alias.
    model: "gpt-5.1",
    // Non-standard param used in your other project; OpenAI SDK will pass it through.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(cacheRetention
      ? ({ prompt_cache_retention: cacheRetention } as any)
      : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(promptCacheKey ? ({ prompt_cache_key: promptCacheKey } as any) : {}),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: itemString },
    ],
  });

  if (process.env.NODE_ENV !== "production") {
    // Keep logs similar to the other project's gpt.js for visibility.
    console.log("GPT usage:", resp.usage);
  }

  return resp.choices[0]?.message?.content ?? "";
}

export async function gptChatWithUsage(
  params: GptChatParams,
): Promise<{ output: string; usage: GptUsage | null }> {
  checkPrompt(params.systemPrompt);

  const resp = await getClient().chat.completions.create({
    model: "gpt-5.2",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(params.cacheRetention
      ? ({ prompt_cache_retention: params.cacheRetention } as any)
      : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(params.promptCacheKey
      ? ({ prompt_cache_key: params.promptCacheKey } as any)
      : {}),
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.itemString },
    ],
  });

  const usage = (resp.usage ?? null) as unknown as GptUsage | null;

  if (process.env.NODE_ENV !== "production") {
    console.log("GPT usage:", resp.usage);
  }

  return { output: resp.choices[0]?.message?.content ?? "", usage };
}
