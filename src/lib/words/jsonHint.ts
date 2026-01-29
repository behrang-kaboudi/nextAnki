export const JSON_HINT_GENERATED_AT_FIELD = "generatedAtMs" as const;

function asTrimmedNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeJsonHintForCompare(jsonHint: string | null): string | null {
  const raw = asTrimmedNonEmptyString(jsonHint);
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return null;

    const record = obj as Record<string, unknown>;
    delete record[JSON_HINT_GENERATED_AT_FIELD];
    return JSON.stringify(record);
  } catch {
    return null;
  }
}

export function getJsonHintGeneratedAtMs(jsonHint: string | null): number | null {
  const raw = asTrimmedNonEmptyString(jsonHint);
  if (!raw) return null;

  try {
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return null;
    const value = (obj as Record<string, unknown>)[JSON_HINT_GENERATED_AT_FIELD];
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return Math.trunc(value);
  } catch {
    return null;
  }
}

export function stringifyJsonHintWithTimestamp(
  jsonHintObject: unknown,
  nowMs: number = Date.now()
): string | null {
  if (!jsonHintObject || typeof jsonHintObject !== "object") return null;
  const record = jsonHintObject as Record<string, unknown>;
  return JSON.stringify({ ...record, [JSON_HINT_GENERATED_AT_FIELD]: nowMs });
}
