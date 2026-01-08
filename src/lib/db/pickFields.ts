export function pickFields<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const key of keys) out[key] = row[key];
  return out;
}
