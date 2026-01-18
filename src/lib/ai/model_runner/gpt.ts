import "server-only";

import OpenAI from "openai";

// Setup:
// - Add this to `.env.local` (recommended) or `.env`:
//   OPENAI_API_KEY="PASTE_YOUR_KEY_HERE"

type GptChatParams = {
  itemString: string;
  systemPrompt: string;
  cacheRetention?: "in_memory" | "24h";
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
}: GptChatParams): Promise<string> {
  checkPrompt(systemPrompt);

  const resp = await getClient().chat.completions.create({
    // Keep same model string as the referenced file; change if your account uses a different alias.
    model: "gpt-5.2",
    // Non-standard param used in your other project; OpenAI SDK will pass it through.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(cacheRetention ? ({ prompt_cache_retention: cacheRetention } as any) : {}),
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
