import {
  BOUNDARY,
  KNOWN_AFFRICATES,
  KNOWN_DIPHTHONGS,
  LENGTH,
  SPACING_MODIFIERS,
  STRESS,
  TIE_BARS,
  VOWELS,
  boundaryKindOf,
  isCombiningMark,
  normalizeIPA,
  stressKindOf,
} from "./ipaSets";

type StressKind = "primary" | "secondary" | null;

type SegmentCategory = "UNKNOWN" | "AFFRICATE" | "VOWEL" | "CONSONANT" | "CLUSTER";

export type IpaSegmentToken = {
  type: "SEGMENT";
  text: string;
  stress: StressKind;
  category: SegmentCategory;
  baseSymbols: string[];
  tieBars: string[];
  diacritics: string[];
  modifiers: string[];
  lengthMarks: string[];
  isAffricate: boolean;
  start?: number;
  end?: number;
};

export type IpaToken =
  | IpaSegmentToken
  | {
      type: "STRESS";
      text: string;
      stress: StressKind;
      kind: string;
      start?: number;
      end?: number;
    }
  | {
      type: "BOUNDARY";
      text: string;
      stress: null;
      kind: ReturnType<typeof boundaryKindOf>;
      start?: number;
      end?: number;
    }
  | {
      type: "UNKNOWN";
      text: string;
      stress: null;
      start?: number;
      end?: number;
    };

function parseSegmentText(text: string) {
  const chars = Array.from(text.normalize("NFD"));

  const baseSymbols: string[] = [];
  const tieBars: string[] = [];
  const diacritics: string[] = [];
  const modifiers: string[] = [];
  const lengthMarks: string[] = [];

  for (const ch of chars) {
    if (TIE_BARS.has(ch)) {
      tieBars.push(ch);
      continue;
    }
    if (isCombiningMark(ch)) {
      diacritics.push(ch);
      continue;
    }
    if (SPACING_MODIFIERS.has(ch)) {
      modifiers.push(ch);
      continue;
    }
    if (LENGTH.has(ch)) {
      lengthMarks.push(ch);
      continue;
    }
    baseSymbols.push(ch);
  }

  const isAffricate = tieBars.length > 0 && baseSymbols.length >= 2;
  return {
    baseSymbols,
    tieBars,
    diacritics,
    modifiers,
    lengthMarks,
    isAffricate,
  };
}

function categorizeSegment(parsed: ReturnType<typeof parseSegmentText>): SegmentCategory {
  const { baseSymbols, isAffricate } = parsed;

  if (!baseSymbols || baseSymbols.length === 0) return "UNKNOWN";
  if (isAffricate) return "AFFRICATE";

  if (baseSymbols.length === 1) {
    return VOWELS.has(baseSymbols[0]) ? "VOWEL" : "CONSONANT";
  }

  const anyVowel = baseSymbols.some((x) => VOWELS.has(x));
  const allVowels = baseSymbols.every((x) => VOWELS.has(x));

  if (allVowels) return "VOWEL";
  if (!anyVowel) return "CLUSTER";
  return "CLUSTER";
}

export function ipaToTokenObjects(
  ipa: string,
  opt: Partial<{
    keepBoundaries: boolean;
    keepStressTokens: boolean;
    attachStressToNext: boolean;
    assumeAdjacentAffricate: boolean;
    keepPositions: boolean;
  }> = {}
): IpaToken[] {
  /**
   * Guide (FA): `src/lib/ipa/ipaToTokenObjects.guide.fa.md`
   */
  ipa = normalizeIPA(ipa);
  const options = {
    keepBoundaries: false,
    keepStressTokens: true,
    attachStressToNext: true,
    assumeAdjacentAffricate: true,
    keepPositions: true,
    ...opt,
  };

  const s = ipa.normalize("NFD");
  const chars = Array.from(s);

  const tokens: IpaToken[] = [];

  let cur = "";
  let awaitingAffricateSecond = false;
  let pendingStress: StressKind = null;
  let curStart: number | null = null;
  let idx = 0;

  const pushSegment = (endIdx: number) => {
    if (!cur) return;

    const parsed = parseSegmentText(cur);
    const category = categorizeSegment(parsed);

    const tok: IpaSegmentToken = {
      type: "SEGMENT",
      text: cur,
      stress: pendingStress,
      category,
      ...parsed,
    };

    if (options.keepPositions) {
      tok.start = curStart ?? Math.max(0, endIdx - Array.from(cur).length);
      tok.end = endIdx;
    }

    tokens.push(tok);
    cur = "";
    curStart = null;
    pendingStress = null;
  };

  const pushStressToken = (ch: string) => {
    const kind = stressKindOf(ch) as StressKind;
    if (options.keepStressTokens) {
      const t: IpaToken = {
        type: "STRESS",
        text: ch,
        stress: kind,
        kind: (kind || "stress").toUpperCase(),
      };
      if (options.keepPositions) {
        t.start = idx;
        t.end = idx + 1;
      }
      tokens.push(t);
    }
    if (options.attachStressToNext) pendingStress = kind;
  };

  const pushBoundaryToken = (ch: string) => {
    if (!options.keepBoundaries) return;
    const t: IpaToken = {
      type: "BOUNDARY",
      text: ch,
      stress: null,
      kind: boundaryKindOf(ch),
    };
    if (options.keepPositions) {
      t.start = idx;
      t.end = idx + 1;
    }
    tokens.push(t);
  };

  const isBaseSymbol = (ch: string) => {
    if (!ch) return false;
    if (isCombiningMark(ch)) return false;
    if (TIE_BARS.has(ch)) return false;
    if (STRESS.has(ch)) return false;
    if (BOUNDARY.has(ch)) return false;
    if (LENGTH.has(ch)) return false;
    if (SPACING_MODIFIERS.has(ch)) return false;
    return true;
  };

  for (let i = 0; i < chars.length; i++, idx++) {
    const ch = chars[i];
    const next = chars[i + 1] || "";

    if (STRESS.has(ch)) {
      pushSegment(idx);
      awaitingAffricateSecond = false;
      pushStressToken(ch);
      continue;
    }

    if (BOUNDARY.has(ch)) {
      pushSegment(idx);
      awaitingAffricateSecond = false;
      pushBoundaryToken(ch);
      continue;
    }

    if (TIE_BARS.has(ch)) {
      if (!cur) {
        cur = ch;
        curStart = idx;
      } else {
        cur += ch;
      }
      awaitingAffricateSecond = true;
      continue;
    }

    if (isCombiningMark(ch)) {
      if (cur) {
        cur += ch;
      } else if (tokens.length && tokens[tokens.length - 1].type === "SEGMENT") {
        const last = tokens[tokens.length - 1] as IpaSegmentToken;
        last.text += ch;
        last.diacritics.push(ch);
        if (options.keepPositions) last.end = idx + 1;
      } else {
        const t: IpaToken = { type: "UNKNOWN", text: ch, stress: null };
        if (options.keepPositions) {
          t.start = idx;
          t.end = idx + 1;
        }
        tokens.push(t);
      }
      continue;
    }

    if (LENGTH.has(ch)) {
      if (cur) {
        cur += ch;
      } else if (tokens.length && tokens[tokens.length - 1].type === "SEGMENT") {
        const last = tokens[tokens.length - 1] as IpaSegmentToken;
        last.text += ch;
        last.lengthMarks.push(ch);
        if (options.keepPositions) last.end = idx + 1;
      } else {
        const t: IpaToken = { type: "UNKNOWN", text: ch, stress: null };
        if (options.keepPositions) {
          t.start = idx;
          t.end = idx + 1;
        }
        tokens.push(t);
      }
      continue;
    }

    if (SPACING_MODIFIERS.has(ch)) {
      if (cur) {
        cur += ch;
      } else if (tokens.length && tokens[tokens.length - 1].type === "SEGMENT") {
        const last = tokens[tokens.length - 1] as IpaSegmentToken;
        last.text += ch;
        last.modifiers.push(ch);
        if (options.keepPositions) last.end = idx + 1;
      } else {
        const t: IpaToken = { type: "UNKNOWN", text: ch, stress: null };
        if (options.keepPositions) {
          t.start = idx;
          t.end = idx + 1;
        }
        tokens.push(t);
      }
      continue;
    }

    if (awaitingAffricateSecond) {
      if (!cur) {
        cur = ch;
        curStart = idx;
      } else {
        cur += ch;
      }
      awaitingAffricateSecond = false;
      continue;
    }

    if (isBaseSymbol(ch) && isBaseSymbol(next)) {
      const pairVV = ch + next;
      if (KNOWN_DIPHTHONGS.has(pairVV)) {
        pushSegment(idx);
        cur = pairVV;
        curStart = idx;
        i++;
        idx++;
        continue;
      }
    }

    if (options.assumeAdjacentAffricate && isBaseSymbol(ch) && isBaseSymbol(next)) {
      const pair = ch + next;
      if (KNOWN_AFFRICATES.has(pair)) {
        pushSegment(idx);
        cur = pair;
        curStart = idx;
        i++;
        idx++;
        continue;
      }
    }

    if (isBaseSymbol(ch)) {
      pushSegment(idx);
      cur = ch;
      curStart = idx;
      continue;
    }

    pushSegment(idx);
    const t: IpaToken = { type: "UNKNOWN", text: ch, stress: null };
    if (options.keepPositions) {
      t.start = idx;
      t.end = idx + 1;
    }
    tokens.push(t);
  }

  pushSegment(idx);
  return tokens;
}
