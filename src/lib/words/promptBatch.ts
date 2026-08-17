export function parsePromptBatchSize(value: unknown, defaultBatchSize: number) {
  const batchSize = value ?? defaultBatchSize;
  return typeof batchSize === "number" && Number.isSafeInteger(batchSize) && batchSize >= 0
    ? batchSize
    : null;
}

export function selectPromptBatch<T>(items: readonly T[], batchSize: number) {
  return items.slice(0, batchSize);
}
