import { ankiRequestDetailed } from "@/lib/AnkiConnect";

export async function loadDeckNames() {
  const res = await ankiRequestDetailed("deckNames");
  if (!res.ok) return { ok: false as const, error: res.error };
  const deckNames = res.result;
  if (!deckNames) return { ok: false as const, error: "AnkiConnect returned null for deckNames." };
  return { ok: true as const, deckNames, deckSet: new Set(deckNames) };
}
