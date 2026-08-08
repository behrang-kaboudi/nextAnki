export const DEFAULT_LM_STUDIO_BASE_URL = "http://localhost:1234/v1";

export type LocalChatRole = "system" | "user" | "assistant";

export type LocalChatMessage = {
  role: LocalChatRole;
  content: string;
};

export type AiModelSettings = Record<string, string | number | boolean | null>;

export const DEFAULT_AI_MODEL_SETTINGS: AiModelSettings = {
  temperature: 0.7,
  top_p: 0.95,
  max_tokens: 1024,
};

const RESERVED_CHAT_SETTINGS = new Set(["model", "messages", "stream"]);

export function normalizeBaseUrl(value: unknown): string {
  const text = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  const fallback = text || DEFAULT_LM_STUDIO_BASE_URL;
  const url = new URL(fallback);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL must use http or https.");
  }
  return url.toString().replace(/\/$/, "");
}

export function normalizeModelSettings(value: unknown): AiModelSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Settings must be a JSON object.");
  }

  const settings: AiModelSettings = {};
  for (const [key, settingValue] of Object.entries(value)) {
    if (!key.trim() || RESERVED_CHAT_SETTINGS.has(key)) continue;
    if (
      settingValue === null ||
      typeof settingValue === "string" ||
      typeof settingValue === "number" ||
      typeof settingValue === "boolean"
    ) {
      settings[key] = settingValue;
    } else {
      throw new Error(`Setting \"${key}\" must be a string, number, boolean, or null.`);
    }
  }
  return settings;
}

export function normalizeChatMessages(value: unknown): LocalChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("Messages must contain between 1 and 100 items.");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Message ${index + 1} is invalid.`);
    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = typeof record.content === "string" ? record.content.trim() : "";
    if (role !== "user" && role !== "assistant" && role !== "system") {
      throw new Error(`Message ${index + 1} has an invalid role.`);
    }
    if (!content || content.length > 100_000) {
      throw new Error(`Message ${index + 1} must contain 1 to 100,000 characters.`);
    }
    return { role, content };
  });
}
