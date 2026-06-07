export function normalizeStable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeStable);
  if (value && typeof value === "object") {
    const maybeDecimal = value as { toString?: () => string; constructor?: { name?: string } };
    if (maybeDecimal.constructor?.name === "Decimal" && typeof maybeDecimal.toString === "function") {
      return maybeDecimal.toString();
    }

    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, normalizeStable(record[key])])
    );
  }
  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(normalizeStable(value), null, 2);
}

export function compareStable(a: unknown, b: unknown) {
  const left = stableStringify(a);
  const right = stableStringify(b);
  return left < right ? -1 : left > right ? 1 : 0;
}
