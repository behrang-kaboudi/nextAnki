export const AnkiTag = {
  Filtered: "Filtered",
} as const;

export type AnkiTag = (typeof AnkiTag)[keyof typeof AnkiTag];
