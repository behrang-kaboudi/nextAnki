import "server-only";

import { GoogleGenAI } from "@google/genai";

import crypto from "node:crypto";

import { normalizePromptForCache } from "@/lib/ai/prompt_cache/normalize";

export type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
};

export type GeminiCacheInfo = {
  name: string;
  promptSha256: string;
  created: boolean;
  expireTime?: string;
  cachedTokensUsed?: number;
};

let client: GoogleGenAI | null = null;

const globalForGemini = globalThis as unknown as {
  sentenceFieldsCache?: {
    name: string;
    promptSha256: string;
    expireTimeMs: number;
  };
  sentenceFieldsCacheInit?: {
    promptSha256: string;
    promise: Promise<{ name: string; expireTime?: string; expireTimeMs: number }>;
  };
};

function getClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function parseExpireTimeMs(expireTime?: string): number {
  if (!expireTime) return 0;
  const ms = Date.parse(expireTime);
  return Number.isFinite(ms) ? ms : 0;
}

export async function geminiGenerateWithExplicitCache(params: {
  model?: string;
  systemPrompt: string;
  userText: string;
  cacheDisplayName?: string;
  ttlSeconds?: number;
}): Promise<{ output: string; usage: GeminiUsage | null; cache: GeminiCacheInfo }> {
  const ai = getClient();
  const model = params.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (/^gemini[-_ ]?3$/i.test(model.trim())) {
    throw new Error(
      "Invalid GEMINI_MODEL: 'gemini-3' is not a valid model id. Use a concrete id like 'gemini-3-flash-preview' or 'gemini-3-pro-preview' (if available to your account)."
    );
  }

  // Validate model early for clearer errors (and before cache creation).
  await ai.models.get({ model });

  const normalizedPrompt = normalizePromptForCache(params.systemPrompt);
  const promptSha = sha256(normalizedPrompt);

  const cached = globalForGemini.sentenceFieldsCache;
  const now = Date.now();
  const canReuse =
    Boolean(cached?.name) &&
    cached?.promptSha256 === promptSha &&
    cached?.expireTimeMs &&
    cached.expireTimeMs - now > 60_000; // 60s safety margin

  let cacheName: string;
  let created = false;
  let expireTime: string | undefined;

  if (canReuse) {
    cacheName = cached!.name;
    if (process.env.NODE_ENV !== "production") {
      console.log("gemini explicit cache: reuse", {
        name: cacheName,
        promptSha256: cached!.promptSha256,
        expireInSec: Math.round((cached!.expireTimeMs - now) / 1000),
      });
    }
  } else {
    const inflight = globalForGemini.sentenceFieldsCacheInit;
    if (inflight && inflight.promptSha256 === promptSha) {
      const res = await inflight.promise;
      cacheName = res.name;
      expireTime = res.expireTime;
      if (process.env.NODE_ENV !== "production") {
        console.log("gemini explicit cache: reuse(inflight)", {
          name: cacheName,
          promptSha256: promptSha,
        });
      }
    } else {
      const ttlSeconds = params.ttlSeconds ?? 60 * 60 * 24; // 24h
      const promise = (async () => {
        const createdCache = await ai.caches.create({
          model,
          config: {
            displayName: params.cacheDisplayName ?? "sentence-fields-v1",
            ttl: `${ttlSeconds}s`,
            systemInstruction: normalizedPrompt,
          },
        });
        const name = createdCache.name ?? "";
        if (!name) throw new Error("Gemini cache creation failed: missing cache name");
        const expire = createdCache.expireTime;
        const expMs = parseExpireTimeMs(expire);
        if (process.env.NODE_ENV !== "production") {
          console.log("gemini explicit cache: create", {
            name,
            promptSha256: promptSha,
            expireTime: expire,
            cachedContentTokenCount: createdCache.usageMetadata?.totalTokenCount,
          });
        }
        return { name, expireTime: expire, expireTimeMs: expMs };
      })();

      globalForGemini.sentenceFieldsCacheInit = { promptSha256: promptSha, promise };
      try {
        const res = await promise;
        cacheName = res.name;
        expireTime = res.expireTime;
        created = true;
        globalForGemini.sentenceFieldsCache = {
          name: cacheName,
          promptSha256: promptSha,
          expireTimeMs: res.expireTimeMs,
        };
      } finally {
        if (globalForGemini.sentenceFieldsCacheInit?.promise === promise) {
          globalForGemini.sentenceFieldsCacheInit = undefined;
        }
      }
    }
  }

  const resp = await ai.models.generateContent({
    model,
    contents: params.userText,
    config: {
      cachedContent: cacheName,
    },
  });

  const usage = (resp.usageMetadata ?? null) as unknown as GeminiUsage | null;
  const output = String(resp.text ?? "");

  if (process.env.NODE_ENV !== "production") {
    console.log("gemini explicit cache: usage", {
      cachedContentTokenCount: usage?.cachedContentTokenCount ?? 0,
      promptTokenCount: usage?.promptTokenCount ?? null,
      totalTokenCount: usage?.totalTokenCount ?? null,
    });
  }

  return {
    output,
    usage,
    cache: {
      name: cacheName,
      promptSha256: promptSha,
      created,
      expireTime,
      cachedTokensUsed: usage?.cachedContentTokenCount,
    },
  };
}
