import "server-only";

import { getIpaKeywordsFromDb } from "./ipaKeywordsDb";
import { getIpaSegments, normalVolIPAs } from "./normalize";

type KeywordRow = Awaited<ReturnType<typeof getIpaKeywordsFromDb>>[number];
type KeywordWithIpa = KeywordRow & { ipa: string };

declare global {
  var __ipaMapWithConvertPromise: Promise<KeywordWithIpa[]> | undefined;
}

async function getIpaMapWithConvert(): Promise<KeywordWithIpa[]> {
  if (!globalThis.__ipaMapWithConvertPromise) {
    globalThis.__ipaMapWithConvertPromise = (async () => {
      const ipaKeywords = await getIpaKeywordsFromDb();
      const map: KeywordWithIpa[] = [];

      for (let i = 0; i < ipaKeywords.length; i++) {
        const ipaObj = ipaKeywords[i]!;
        const tokens = getIpaSegments(ipaObj.ipa_fa, ipaObj.ipa_fa.length);
        const ipa = tokens.join("");
        map.push({ ipa, ...ipaObj });
      }
      return map;
    })();
  }
  return globalThis.__ipaMapWithConvertPromise;
}

function buildIpaMap(ipa2L: string) {
  const map = [ipa2L];
  let changeIY = ipa2L.replace(/ɪ/g, "j");
  if (changeIY === ipa2L) changeIY = ipa2L.replace(/j/g, "ɪ");
  if (changeIY !== ipa2L) map.push(changeIY);
  const changeIE = ipa2L.replace(/ɪ/g, "e");
  if (changeIE !== ipa2L) map.push(changeIE);
  let changeJG = ipa2L.replace(/ʒ/g, "ʤ");
  if (changeJG === ipa2L) changeJG = ipa2L.replace(/ʤ/g, "ʒ");
  if (changeJG !== ipa2L) map.push(changeJG);
  if (typeof ipa2L !== "string" || ipa2L.length < 2) return map;
  if (normalVolIPAs.has(ipa2L[0]!) || normalVolIPAs.has(ipa2L[1]!)) return map;

  for (const v of normalVolIPAs) {
    map.push(ipa2L[0]! + v + ipa2L[1]!);
  }

  if (ipa2L[0] === "s") {
    const addS: string[] = [];
    for (let i = 0; i < map.length; i++) addS.push("e" + map[i]);
    map.push(...addS);
  }

  return map;
}

function getKeysBasket(ipaString: string) {
  const tokens = getIpaSegments(ipaString, 5);
  const basket: string[] = [];

  if (tokens.length === 1) {
    basket.push(tokens[0]!);
    return basket;
  }

  const addedToken =
    tokens[0]! +
    tokens[1]! +
    (tokens[2] || "") +
    (tokens[3] || "") +
    (tokens[4] || "");
  let key1 = "";
  let key2 = "";
  let key3 = "";

  if (tokens.length > 1) key1 = addedToken[0]! + addedToken[1]!;
  if (tokens.length > 2) key2 = addedToken[0]! + addedToken[2]!;
  if (tokens.length > 3) key3 = addedToken[0]! + addedToken[3]!;

  if (key1) basket.push(...buildIpaMap(key1));
  if (key2) basket.push(...buildIpaMap(key2));
  if (key3) basket.push(...buildIpaMap(key3));

  return basket;
}

async function getAllowdWord(ipaString: string) {
  const basket = getKeysBasket(ipaString);
  const ipaMapWithConvert = await getIpaMapWithConvert();

  const allowedWords: KeywordWithIpa[] = [];

  for (let i = 0; i < basket.length; i++) {
    const key = basket[i]!;
    for (let j = 0; j < ipaMapWithConvert.length; j++) {
      const ipaObj = ipaMapWithConvert[j]!;
      if (ipaObj.ipa.startsWith(key) || key.startsWith(ipaObj.ipa))
        allowedWords.push(ipaObj);
    }
  }

  const uniqueByIpa: KeywordWithIpa[] = [];
  const seenIpa = new Set<string>();
  for (const word of allowedWords) {
    if (seenIpa.has(word.ipa)) continue;
    seenIpa.add(word.ipa);
    uniqueByIpa.push(word);
  }

  return uniqueByIpa;
}

const DEFAULT_PREFIX_LEN = 5;

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }
  return dp[a.length]![b.length]!;
}

function prefixIPA(ipa: string, n = DEFAULT_PREFIX_LEN) {
  return [...ipa].slice(0, n).join("");
}

function toSymbols(str: string) {
  return [...str].map((ch) => (ch === "j" ? "ɪ" : ch));
}

function canonicalizeInitialSE(ipa: string) {
  if (ipa && ipa.startsWith("es")) return "s" + ipa.slice(2);
  return ipa;
}

const SHIFTY_PREFIXES = ["kem", "ken", "ke", "ɪn", "re", "de"];

function applyCommonPrefixShiftVariant(ipa: string) {
  if (!ipa) return ipa;
  const canon = ipa;
  if (!SHIFTY_PREFIXES.some((p) => canon.startsWith(p))) return canon;
  const symbols = toSymbols(canon);
  if (symbols.length < 4) return canon;
  symbols.splice(2, 1);
  return symbols.join("");
}

function getIpaVariantsForScoring(ipa: string) {
  const canon = canonicalizeInitialSE(ipa);
  const shifted = applyCommonPrefixShiftVariant(canon);
  if (shifted !== canon) return [canon, shifted];
  return [canon];
}

function prefixSimilarityCount(
  a: string,
  b: string,
  n: number,
  { allowInitialSEGate = false } = {}
) {
  const aa = toSymbols(a);
  const bb = toSymbols(b);
  let count = 0;
  for (let i = 0; i < n; i++) {
    const sa = aa[i];
    const sb = bb[i];
    if (!sa || !sb) continue;
    if (sa === sb) {
      count++;
      continue;
    }
    if (allowInitialSEGate && i === 0) {
      if ((sa === "s" && sb === "e") || (sa === "e" && sb === "s")) count++;
    }
  }
  return count;
}

const IPA_VOWELS = new Set(["e", "æ", "ʌ", "ɪ", "ʊ", "o"]);

function isConsonant(symbol: string) {
  if (!symbol) return false;
  return !IPA_VOWELS.has(symbol);
}

function consonantMatchCountOnPrefix(
  inputIPA: string,
  targetIPA: string,
  prefixLen: number
) {
  const a = toSymbols(prefixIPA(inputIPA, prefixLen));
  const b = toSymbols(prefixIPA(targetIPA, prefixLen));
  let matches = 0;
  for (let i = 0; i < prefixLen; i++) {
    const sa = a[i];
    const sb = b[i];
    if (!sa || !sb) continue;
    if (sa === sb && isConsonant(sa)) matches++;
  }
  return matches;
}

function bagMatchCountOnPrefix(
  inputIPA: string,
  targetIPA: string,
  prefixLen: number,
  predicate?: (s: string) => boolean
) {
  const a = toSymbols(prefixIPA(inputIPA, prefixLen)).filter(
    (x) => x && (!predicate || predicate(x))
  );
  const b = toSymbols(prefixIPA(targetIPA, prefixLen)).filter(
    (x) => x && (!predicate || predicate(x))
  );
  const counts = new Map<string, number>();
  for (const s of a) counts.set(s, (counts.get(s) || 0) + 1);
  let common = 0;
  for (const s of b) {
    const c = counts.get(s) || 0;
    if (c > 0) {
      common++;
      counts.set(s, c - 1);
    }
  }
  return common;
}

function firstConsonantBigram(ipa: string, prefixLen: number) {
  const symbols = toSymbols(prefixIPA(ipa, prefixLen));
  const consonants = symbols.filter((s) => isConsonant(s));
  if (consonants.length < 2) return null;
  return consonants[0]! + consonants[1]!;
}

function passesPrefixGates(
  inputIPA: string,
  targetIPA: string,
  { gate1Len, gate2Len }: { gate1Len: number; gate2Len: number }
) {
  const variants = getIpaVariantsForScoring(inputIPA);
  const allowInitialSEGate = true;
  for (const v of variants) {
    const gate1 = prefixSimilarityCount(v, targetIPA, gate1Len, {
      allowInitialSEGate,
    });
    const gate2 = prefixSimilarityCount(v, targetIPA, gate2Len, {
      allowInitialSEGate,
    });
    if (
      gate1 >= Math.max(1, gate1Len - 1) &&
      gate2 >= Math.max(1, gate2Len - 2)
    )
      return { pass: true };
  }
  return { pass: false };
}

function buildRankFeatures(
  inputIPA: string,
  targetIPA: string,
  {
    prefixLen,
    gate1Len,
    gate2Len,
  }: { prefixLen: number; gate1Len: number; gate2Len: number }
) {
  const gatePass = passesPrefixGates(inputIPA, targetIPA, {
    gate1Len,
    gate2Len,
  }).pass;
  return {
    gatePass,
    prefixVowelBag: bagMatchCountOnPrefix(
      inputIPA,
      targetIPA,
      prefixLen,
      (s) => !isConsonant(s)
    ),
    prefixConsBag: bagMatchCountOnPrefix(inputIPA, targetIPA, prefixLen, (s) =>
      isConsonant(s)
    ),
    prefixConsExact: consonantMatchCountOnPrefix(
      inputIPA,
      targetIPA,
      prefixLen
    ),
    firstConsBigramMatch:
      firstConsonantBigram(inputIPA, prefixLen) ===
      firstConsonantBigram(targetIPA, prefixLen)
        ? 1
        : 0,
  };
}

function phoneticDistance(
  inputIPA: string,
  targetIPA: string,
  {
    includeRejected,
    prefixLen,
    gate1Len,
    gate2Len,
  }: {
    includeRejected: boolean;
    prefixLen: number;
    gate1Len: number;
    gate2Len: number;
  }
) {
  const gatePass = passesPrefixGates(inputIPA, targetIPA, {
    gate1Len,
    gate2Len,
  }).pass;
  if (!gatePass && !includeRejected) return 1e12;

  const a = prefixIPA(inputIPA, prefixLen);
  const b = prefixIPA(targetIPA, prefixLen);
  let dist = editDistance(a, b);

  const features = buildRankFeatures(inputIPA, targetIPA, {
    prefixLen,
    gate1Len,
    gate2Len,
  });
  dist -= features.prefixConsExact * 0.6;
  dist -= features.firstConsBigramMatch * 0.8;
  dist -= features.prefixConsBag * 0.25;
  dist -= features.prefixVowelBag * 0.2;

  if (!gatePass) dist += 1000;
  return dist;
}

function findMostSimilarIPA(
  inputIPA: string,
  items: KeywordWithIpa[],
  limit = 8,
  {
    includeRejected = false,
    prefixLen = DEFAULT_PREFIX_LEN,
    gate1Len = DEFAULT_PREFIX_LEN - 1,
    gate2Len = DEFAULT_PREFIX_LEN,
  }: {
    includeRejected?: boolean;
    prefixLen?: number;
    gate1Len?: number;
    gate2Len?: number;
  } = {}
) {
  return items
    .map((item) => {
      const features = buildRankFeatures(inputIPA, item.ipa, {
        prefixLen,
        gate1Len,
        gate2Len,
      });
      const score = phoneticDistance(inputIPA, item.ipa, {
        includeRejected,
        prefixLen,
        gate1Len,
        gate2Len,
      });
      return { ...item, score, features };
    })
    .filter((item) => (includeRejected ? true : item.features.gatePass))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.ipa.localeCompare(b.ipa))
    .slice(0, limit);
}

function hash32FNV1a(str: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function makeRng(seed: number) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0xffffffff;
  };
}

const selectionCounts = new Map<string, number>();

function pickWeightedByScore<
  T extends { score: number; ipa?: string; number?: number }
>(
  items: T[],
  seedStr: string,
  {
    topK = 10,
    temperature = null,
    diversityKey = "ipa",
    diversityAlpha = 0.12,
    diversityCap = 200,
    diversityDeltaPenalty = 0.15,
  }: {
    topK?: number;
    temperature?: number | null;
    diversityKey?: "ipa" | "number" | null;
    diversityAlpha?: number;
    diversityCap?: number;
    diversityDeltaPenalty?: number;
  } = {}
) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const k = Math.max(
    1,
    Math.min(items.length, Number.isFinite(topK) ? topK : 8)
  );
  const slice = items.slice(0, k);
  const best = slice[0]!.score;

  const isRejectSpace = best > 1e8;
  const temp =
    typeof temperature === "number" && Number.isFinite(temperature)
      ? Math.max(1e-6, temperature)
      : isRejectSpace
      ? 400
      : 1.0;

  const weights: number[] = [];
  let sum = 0;
  for (const it of slice) {
    let delta = it.score - best;

    if (diversityKey) {
      const key =
        diversityKey === "number"
          ? String(it.number ?? "")
          : String(it.ipa ?? "");
      if (key) {
        const c = selectionCounts.get(key) || 0;
        const capped = Math.min(c, diversityCap);
        delta += capped * diversityDeltaPenalty;

        const mult = 1 + diversityAlpha * capped;
        if (mult > 1) delta += Math.log(mult) * temp;
      }
    }
    const w = Math.exp(-delta / temp);
    weights.push(w);
    sum += w;
  }
  if (!Number.isFinite(sum) || sum <= 0) return slice[0]!;

  const rng = makeRng(hash32FNV1a(seedStr));
  let r = rng() * sum;
  for (let i = 0; i < slice.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return slice[i]!;
  }
  return slice[slice.length - 1]!;
}

export async function getKeyWord(
  ipaString: string,
  {
    limit = Infinity,
    includeRejected = true,
    prefixLen = DEFAULT_PREFIX_LEN,
    gate1Len = DEFAULT_PREFIX_LEN - 1,
    gate2Len = DEFAULT_PREFIX_LEN,
    pickOne = true,
    pickTopK = 10,
    pickTemperature = null,
  }: {
    limit?: number;
    includeRejected?: boolean;
    prefixLen?: number;
    gate1Len?: number;
    gate2Len?: number;
    pickOne?: boolean;
    pickTopK?: number;
    pickTemperature?: number | null;
  } = {}
) {
  const normalizedIpa = getIpaSegments(ipaString, 8).join("");
  const allowedWords = await getAllowdWord(ipaString);

  const allKeyWords = findMostSimilarIPA(
    normalizedIpa,
    allowedWords,
    Infinity,
    {
      includeRejected,
      prefixLen,
      gate1Len,
      gate2Len,
    }
  );

  const keyWords =
    limit === Infinity ? allKeyWords : allKeyWords.slice(0, Math.max(0, limit));

  const selected = pickOne
    ? pickWeightedByScore(allKeyWords, normalizedIpa, {
        topK: pickTopK,
        temperature: pickTemperature,
      })
    : null;

  if (selected) {
    const key = String(selected.ipa ?? "");
    if (key) selectionCounts.set(key, (selectionCounts.get(key) || 0) + 1);
  }

  return pickOne ? selected : keyWords;
}
