import type { AnkiDeckConfig } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck/constants";

export function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseNumber(raw: string): number | null {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

export function parseSteps(text: string): number[] | null {
  const raw = text.trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/g).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d+(?:\.\d+)?)([smhd])$/i.exec(p);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const minutes =
      unit === "s"
        ? n / 60
        : unit === "m"
          ? n
          : unit === "h"
            ? n * 60
            : n * 1440;
    out.push(minutes);
  }
  return out;
}

export function arraysEqual(a: number[] | null, b: number[] | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function getPerDay(section: AnkiDeckConfig["new"] | AnkiDeckConfig["rev"]): number | null {
  if (!section) return null;
  return asNumber((section as { perDay?: unknown }).perDay) ?? asNumber((section as { per_day?: unknown }).per_day);
}

export function setPerDay(section: NonNullable<AnkiDeckConfig["new"] | AnkiDeckConfig["rev"]>, value: number) {
  (section as { perDay?: number }).perDay = value;
  (section as { per_day?: number }).per_day = value;
}

export function getInitialFactor(section: AnkiDeckConfig["new"]): number | null {
  if (!section) return null;
  return asNumber((section as { initialFactor?: unknown }).initialFactor) ??
    asNumber((section as { initial_factor?: unknown }).initial_factor);
}

export function setInitialFactor(section: NonNullable<AnkiDeckConfig["new"]>, value: number) {
  (section as { initialFactor?: number }).initialFactor = value;
  (section as { initial_factor?: number }).initial_factor = value;
}

export function getNewInts(section: AnkiDeckConfig["new"]): number[] | null {
  if (!section) return null;
  return Array.isArray(section.ints) ? section.ints : null;
}

export function setGraduatingAndEasyIntervals(
  section: NonNullable<AnkiDeckConfig["new"]>,
  graduatingDays: number,
  easyDays: number,
) {
  const ints = Array.isArray(section.ints) ? section.ints.slice() : [1, 4, 7];
  ints[0] = graduatingDays;
  ints[1] = easyDays;
  if (typeof ints[2] !== "number") ints[2] = 7;
  section.ints = ints;
}

export function deckConfigPairs() {
  return [
    { deck: WordAnkiConstants.decks.EnToFa, configName: "WordsForNewStudyEnToFa" as const },
    { deck: WordAnkiConstants.decks.FaToEn, configName: "WordsForNewStudyFaToEn" as const },
    { deck: WordAnkiConstants.decks.Emla, configName: "WordsForNewStudyEmla" as const },
    { deck: WordAnkiConstants.decks.Rahnama, configName: "WordsForNewStudyRahnama" as const },
    { deck: WordAnkiConstants.decks.Rahnama2, configName: "WordsForNewStudyRahnama2" as const },
  ] as const;
}
