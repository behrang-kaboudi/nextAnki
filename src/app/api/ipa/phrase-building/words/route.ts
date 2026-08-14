import { NextResponse } from "next/server";

import { Prisma, type PictureWord, type WordSense } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pickPictureSymbolsForWord } from "@/lib/ipa/setPictures/setForAny";
import { JSON_HINT_GENERATED_AT_FIELD } from "@/lib/words/jsonHint";
import { hydrateWordSensesWithEnglishFields, type WordSenseEnglishFields } from "@/lib/english/wordSenseEnglishFields.server";

export const runtime = "nodejs";

function parsePositiveInt(value: string | null, fallback: number) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

function parseOptionalPositiveInt(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  return i > 0 ? i : null;
}

function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  const s = value.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function parseSortBy(value: string | null): "base_form" | "phonetic_us_normalized" | "meaning_fa" {
  const s = (value ?? "").trim();
  if (s === "phonetic_us_normalized") return "phonetic_us_normalized";
  if (s === "meaning_fa") return "meaning_fa";
  return "base_form";
}

function parseSortDir(value: string | null): "asc" | "desc" {
  const s = (value ?? "").trim().toLowerCase();
  return s === "desc" ? "desc" : "asc";
}

function hasAnyMatchSymbols(match: {
  person?: Pick<PictureWord, "fa" | "en"> | null;
  job?: Pick<PictureWord, "fa" | "en"> | null;
  adj?: Pick<PictureWord, "fa" | "en"> | null;
} | null): boolean {
  if (!match) return false;
  return Boolean(
    (match.person?.fa ?? "").trim() ||
      (match.person?.en ?? "").trim() ||
      (match.job?.fa ?? "").trim() ||
      (match.job?.en ?? "").trim() ||
      (match.adj?.fa ?? "").trim() ||
      (match.adj?.en ?? "").trim()
  );
}

function isPlaceholderJob(match: {
  job?: Pick<PictureWord, "fa" | "en"> | null;
} | null): boolean {
  const fa = (match?.job?.fa ?? "").trim();
  const en = (match?.job?.en ?? "").trim().toLowerCase();
  return Boolean(fa === "💼" && en === "job");
}

function parseStoredMatch(jsonHint: string | null | undefined): unknown {
  const raw = (jsonHint ?? "").trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = { ...(parsed as Record<string, unknown>) };
    delete record[JSON_HINT_GENERATED_AT_FIELD];
    return record;
  } catch {
    return null;
  }
}

function normalizeMatchForCompare(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalizeMatchForCompare);
  if (typeof value !== "object") return value;

  const normalized: Record<string, unknown> = {};
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record).sort()) {
    if (key === JSON_HINT_GENERATED_AT_FIELD) continue;
    const nextValue = normalizeMatchForCompare(record[key]);
    if (nextValue === undefined) continue;
    normalized[key] = nextValue;
  }
  return normalized;
}

function matchCompareText(value: unknown): string {
  return JSON.stringify(normalizeMatchForCompare(value) ?? null);
}

function matchesDiffer(oldMatch: unknown, newMatch: unknown): boolean {
  return matchCompareText(oldMatch) !== matchCompareText(newMatch);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current]!, current);
    }
  });

  await Promise.all(workers);
  return results;
}

async function loadWordsById(ids: number[]): Promise<Map<number, WordSense & WordSenseEnglishFields>> {
  if (ids.length === 0) return new Map();
  const uniqueIds = Array.from(new Set(ids));
  const words = await hydrateWordSensesWithEnglishFields(await prisma.wordSense.findMany({
    where: { id: { in: uniqueIds } },
  }));
  return new Map(words.map((w) => [w.id, w]));
}

function sseEvent(event: string, value: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`,
  );
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSizeRaw = parsePositiveInt(url.searchParams.get("pageSize"), 50);
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 200);
    const skip = (page - 1) * pageSize;
    const includeMatch = parseBoolean(url.searchParams.get("includeMatch"));
    const includeMatchStats = parseBoolean(
      url.searchParams.get("includeMatchStats")
    );
    const stream = parseBoolean(url.searchParams.get("stream"));
    const sortBy = parseSortBy(url.searchParams.get("sortBy"));
    const sortDir = parseSortDir(url.searchParams.get("sortDir"));
    const onlySpaced = parseBoolean(url.searchParams.get("onlySpaced"));
    const onlyEmptyMatch = parseBoolean(url.searchParams.get("onlyEmptyMatch"));
    const onlyNoJob = parseBoolean(url.searchParams.get("onlyNoJob"));
    const onlyDifferentMatch = parseBoolean(
      url.searchParams.get("onlyDifferentMatch")
    );
    if (onlyEmptyMatch && onlyNoJob) {
      return NextResponse.json(
        { error: "onlyEmptyMatch and onlyNoJob cannot both be enabled" },
        { status: 400 }
      );
    }

    const phoneticLen = parseOptionalPositiveInt(
      url.searchParams.get("phoneticLen")
    );
    const phoneticLenGt = parseOptionalPositiveInt(
      url.searchParams.get("phoneticLenGt")
    );
    const includeSpacedFiveForFour = parseBoolean(
      url.searchParams.get("includeSpacedFiveForFour")
    );
    const includeSpacedSixForFive = parseBoolean(
      url.searchParams.get("includeSpacedSixForFive")
    );
    const useFourOrSpacedFive =
      phoneticLenGt === null && phoneticLen === 4 && includeSpacedFiveForFour;
    const useFiveOrSpacedSix =
      phoneticLenGt === null && phoneticLen === 5 && includeSpacedSixForFive;
    const phoneticLenWhere =
      phoneticLenGt !== null
        ? Prisma.sql`CHAR_LENGTH(ew.phonetic_us_normalized) > ${phoneticLenGt}`
        : useFourOrSpacedFive
          ? Prisma.sql`(CHAR_LENGTH(ew.phonetic_us_normalized) = 4 OR (CHAR_LENGTH(ew.phonetic_us_normalized) = 5 AND ew.phonetic_us_normalized LIKE '% %'))`
          : useFiveOrSpacedSix
            ? Prisma.sql`(CHAR_LENGTH(ew.phonetic_us_normalized) = 5 OR (CHAR_LENGTH(ew.phonetic_us_normalized) = 6 AND ew.phonetic_us_normalized LIKE '% %'))`
            : Prisma.sql`CHAR_LENGTH(ew.phonetic_us_normalized) = ${phoneticLen}`;
    const spacedWhere = onlySpaced
      ? Prisma.sql`ew.phonetic_us_normalized LIKE '% %'`
      : Prisma.sql`TRUE`;

    const orderByColumnSql = (() => {
      switch (sortBy) {
        case "phonetic_us_normalized":
          return Prisma.raw("ew.phonetic_us_normalized");
        case "meaning_fa":
          return Prisma.raw("pw.canonical_text");
        case "base_form":
        default:
          return Prisma.raw("ew.base_form");
      }
    })();
    const orderByDirSql = sortDir === "desc" ? Prisma.raw("DESC") : Prisma.raw("ASC");

    const [total, rows] = phoneticLen
      ? await Promise.all([
          prisma
            .$queryRaw<Array<{ count: bigint | number }>>`
              SELECT COUNT(*) as count
              FROM word_sense w
              INNER JOIN english_word ew ON ew.id = w.englishId
              WHERE ew.phonetic_us_normalized IS NOT NULL
                AND ew.phonetic_us_normalized <> ''
                AND ${phoneticLenWhere}
                AND ${spacedWhere};
            `,
          prisma.$queryRaw<
            Array<{
              id: number;
              base_form: string;
              phonetic_us_normalized: string | null;
              meaning_fa: string;
              meaning_fa_IPA_normalized: string;
              json_hint: string | null;
            }>
          >`
            SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
            FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
            WHERE ew.phonetic_us_normalized IS NOT NULL
              AND ew.phonetic_us_normalized <> ''
              AND ${phoneticLenWhere}
              AND ${spacedWhere}
            ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
            LIMIT ${pageSize} OFFSET ${skip};
          `,
        ]).then(([countRows, rawRows]) => {
          const countValue = countRows?.[0]?.count ?? 0;
          const asNumber =
            typeof countValue === "bigint" ? Number(countValue) : countValue;
          return [asNumber, rawRows] as const;
        })
      : phoneticLenGt !== null
      ? await Promise.all([
          prisma
            .$queryRaw<Array<{ count: bigint | number }>>`
              SELECT COUNT(*) as count
              FROM word_sense w
              INNER JOIN english_word ew ON ew.id = w.englishId
              WHERE ew.phonetic_us_normalized IS NOT NULL
                AND ew.phonetic_us_normalized <> ''
                AND ${phoneticLenWhere}
                AND ${spacedWhere};
            `,
          prisma.$queryRaw<
            Array<{
              id: number;
              base_form: string;
              phonetic_us_normalized: string | null;
              meaning_fa: string;
              meaning_fa_IPA_normalized: string;
              json_hint: string | null;
            }>
          >`
            SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
            FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
            WHERE ew.phonetic_us_normalized IS NOT NULL
              AND ew.phonetic_us_normalized <> ''
              AND ${phoneticLenWhere}
              AND ${spacedWhere}
            ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
            LIMIT ${pageSize} OFFSET ${skip};
          `,
        ]).then(([countRows, rawRows]) => {
          const countValue = countRows?.[0]?.count ?? 0;
          const asNumber =
            typeof countValue === "bigint" ? Number(countValue) : countValue;
          return [asNumber, rawRows] as const;
        })
      : await Promise.all([
          prisma.$queryRaw<Array<{ count: bigint | number }>>`
            SELECT COUNT(*) AS count FROM word_sense w
              INNER JOIN english_word ew ON ew.id = w.englishId
            WHERE ${spacedWhere};
          `,
          prisma.$queryRaw<Array<{ id: number; base_form: string; phonetic_us_normalized: string | null; meaning_fa: string; meaning_fa_IPA_normalized: string; json_hint: string | null }>>`
            SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
            FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
            WHERE ${spacedWhere}
            ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
            LIMIT ${pageSize} OFFSET ${skip};
          `,
        ]).then(([countRows, rawRows]) => {
          const countValue = countRows?.[0]?.count ?? 0;
          return [typeof countValue === "bigint" ? Number(countValue) : countValue, rawRows] as const;
        });

    if (!includeMatch) {
      return NextResponse.json({ page, pageSize, total, rows });
    }

    if (stream) {
      const responseStream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          try {
            // If we need a computed filter, we must compute
            // matches first on a larger set, then filter + paginate in-memory.
            const needsComputedFilter =
              onlyEmptyMatch || onlyNoJob || onlyDifferentMatch;

            const baseRows = (() => {
              if (!needsComputedFilter) return Promise.resolve(rows);

              const MAX_FILTER_ROWS = 5000;
              if (phoneticLen) {
                return prisma.$queryRaw<
                  Array<{
                    id: number;
                    base_form: string;
                    phonetic_us_normalized: string | null;
                    meaning_fa: string;
                    meaning_fa_IPA_normalized: string;
                    json_hint: string | null;
                  }>
                >`
                  SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
                  FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
                  WHERE ew.phonetic_us_normalized IS NOT NULL
                    AND ew.phonetic_us_normalized <> ''
                    AND ${phoneticLenWhere}
                    AND ${spacedWhere}
                  ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
                  LIMIT ${MAX_FILTER_ROWS};
                `;
              }
              if (phoneticLenGt !== null) {
                return prisma.$queryRaw<
                  Array<{
                    id: number;
                    base_form: string;
                    phonetic_us_normalized: string | null;
                    meaning_fa: string;
                    meaning_fa_IPA_normalized: string;
                    json_hint: string | null;
                  }>
                >`
                  SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
                  FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
                  WHERE ew.phonetic_us_normalized IS NOT NULL
                    AND ew.phonetic_us_normalized <> ''
                    AND ${phoneticLenWhere}
                    AND ${spacedWhere}
                  ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
                  LIMIT ${MAX_FILTER_ROWS};
                `;
              }

              return prisma.$queryRaw<Array<{ id: number; base_form: string; phonetic_us_normalized: string | null; meaning_fa: string; meaning_fa_IPA_normalized: string; json_hint: string | null }>>`
                SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
                FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
                WHERE ${spacedWhere}
                ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
                LIMIT ${MAX_FILTER_ROWS};
              `;
            })();

            const rowsToCompute = await baseRows;
            const wordsById = await loadWordsById(rowsToCompute.map((r) => r.id));

            const idsToProcess = rowsToCompute
              .filter((r) => Boolean(r.phonetic_us_normalized))
              .map((r) => r.id);
            const totalToProcess = idsToProcess.length;
            let done = 0;

            controller.enqueue(sseEvent("start", { total: totalToProcess }));

            const rowById = new Map(rowsToCompute.map((r) => [r.id, r] as const));
            const computed: Array<
              (typeof rowsToCompute)[number] & {
                match: unknown;
                newMatch: unknown;
                oldMatch: unknown;
              }
            > = [];

            await mapWithConcurrency(idsToProcess, 20, async (id) => {
              const word = wordsById.get(id);
              const baseRow = rowById.get(id);
              const match = word ? await pickPictureSymbolsForWord(word) : null;
              done += 1;
              controller.enqueue(sseEvent("progress", { done, total: totalToProcess }));
              if (baseRow) {
                computed.push({
                  ...baseRow,
                  match,
                  newMatch: match,
                  oldMatch: parseStoredMatch(baseRow.json_hint),
                });
              }
              return null;
            });

            for (const row of rowsToCompute) {
              if (row.phonetic_us_normalized) continue;
              computed.push({
                ...row,
                match: null,
                newMatch: null,
                oldMatch: parseStoredMatch(row.json_hint),
              });
            }

            // Keep stable ordering.
            const resultsById = new Map(computed.map((r) => [r.id, r] as const));
            const orderedAll = rowsToCompute.map(
              (r) =>
                resultsById.get(r.id) ?? {
                  ...r,
                  match: null,
                  newMatch: null,
                  oldMatch: parseStoredMatch(r.json_hint),
                }
            );

            let finalRows = orderedAll;
            if (onlyEmptyMatch) {
              finalRows = finalRows.filter((r) => !hasAnyMatchSymbols(r.match as null));
            } else if (onlyNoJob) {
              finalRows = finalRows.filter(
                (r) =>
                  hasAnyMatchSymbols(r.match as null) && isPlaceholderJob(r.match as null)
              );
            }
            if (onlyDifferentMatch) {
              finalRows = finalRows.filter((r) =>
                matchesDiffer(r.oldMatch, r.newMatch)
              );
            }

            const totalForResponse = needsComputedFilter ? finalRows.length : total;
            const sliced = needsComputedFilter ? finalRows.slice(skip, skip + pageSize) : finalRows;

            controller.enqueue(
              sseEvent("done", {
                payload: {
                  page,
                  pageSize,
                  total: totalForResponse,
                  rows: sliced,
                  matchStats: null,
                },
              })
            );
          } catch (e) {
            controller.enqueue(
              sseEvent("job-error", {
                error: e instanceof Error ? e.message : String(e),
              })
            );
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(responseStream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const { rowsWithMatch, totalForResponse } = await (async () => {
      if (!onlyEmptyMatch && !onlyNoJob && !onlyDifferentMatch) {
        const wordsById = await loadWordsById(rows.map((r) => r.id));
        const rowsWithMatch = await mapWithConcurrency(rows, 20, async (row) => {
          const word = wordsById.get(row.id);
          const match =
            row.phonetic_us_normalized && word
              ? await pickPictureSymbolsForWord(word)
              : null;

          return {
            ...row,
            match,
            newMatch: match,
            oldMatch: parseStoredMatch(row.json_hint),
          };
        });
        return { rowsWithMatch, totalForResponse: total };
      }

      // Filtering by computed match fields requires computing match first, so we do an
      // in-memory filtered pagination with a guard.
      const MAX_FILTER_ROWS = 5000;

      const allRows = phoneticLen
        ? await prisma.$queryRaw<
            Array<{
              id: number;
              base_form: string;
              phonetic_us_normalized: string | null;
              meaning_fa: string;
              meaning_fa_IPA_normalized: string;
              json_hint: string | null;
            }>
          >`
            SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
            FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
            WHERE ew.phonetic_us_normalized IS NOT NULL
              AND ew.phonetic_us_normalized <> ''
              AND ${phoneticLenWhere}
              AND ${spacedWhere}
            ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
            LIMIT ${MAX_FILTER_ROWS};
          `
        : phoneticLenGt !== null
          ? await prisma.$queryRaw<
              Array<{
                id: number;
                base_form: string;
                phonetic_us_normalized: string | null;
                meaning_fa: string;
                meaning_fa_IPA_normalized: string;
                json_hint: string | null;
              }>
            >`
              SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
              FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
              WHERE ew.phonetic_us_normalized IS NOT NULL
                AND ew.phonetic_us_normalized <> ''
                AND ${phoneticLenWhere}
                AND ${spacedWhere}
              ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
              LIMIT ${MAX_FILTER_ROWS};
            `
          : await prisma.$queryRaw<Array<{ id: number; base_form: string; phonetic_us_normalized: string | null; meaning_fa: string; meaning_fa_IPA_normalized: string; json_hint: string | null }>>`
              SELECT w.id, ew.base_form, ew.phonetic_us_normalized, COALESCE(pw.canonical_text, '') AS meaning_fa, COALESCE(pw.meaning_fa_IPA_normalize, '') AS meaning_fa_IPA_normalized, ew.json_hint
              FROM word_sense w INNER JOIN english_word ew ON ew.id = w.englishId LEFT JOIN persian_word pw ON pw.id = w.meaningId
              WHERE ${spacedWhere}
              ORDER BY ${orderByColumnSql} ${orderByDirSql}, w.id DESC
              LIMIT ${MAX_FILTER_ROWS};
            `;

      const allIds = allRows.map((r) => r.id);
      const wordsById = await loadWordsById(allIds);
      const allWithMatchFilled = await mapWithConcurrency(
        allRows,
        20,
        async (row) => {
          const word = wordsById.get(row.id);
          const match =
            row.phonetic_us_normalized && word
              ? await pickPictureSymbolsForWord(word)
              : null;
          return {
            ...row,
            match,
            newMatch: match,
            oldMatch: parseStoredMatch(row.json_hint),
          };
        }
      );

      let filtered = allWithMatchFilled;
      if (onlyEmptyMatch) {
        filtered = filtered.filter((r) => !hasAnyMatchSymbols(r.match));
      } else if (onlyNoJob) {
        filtered = filtered.filter(
          (r) => hasAnyMatchSymbols(r.match) && isPlaceholderJob(r.match)
        );
      }
      if (onlyDifferentMatch) {
        filtered = filtered.filter((r) => matchesDiffer(r.oldMatch, r.newMatch));
      }

      // override totals for empty-match view (best-effort; capped by MAX_EMPTY_MATCH_FILTER_ROWS)
      const filteredTotal = filtered.length;
      const sliced = filtered.slice(skip, skip + pageSize);
      return { rowsWithMatch: sliced, totalForResponse: filteredTotal };
    })();

    if (!includeMatchStats) {
      return NextResponse.json({
        page,
        pageSize,
        total: totalForResponse,
        rows: rowsWithMatch,
      });
    }

    const MAX_MATCH_STATS_ROWS = 2000;
    const matchStats =
      total > MAX_MATCH_STATS_ROWS
        ? null
        : await (async () => {
            const all = phoneticLen
              ? await prisma.$queryRaw<
                  Array<{ id: number; phonetic_us_normalized: string | null }>
                >`
                  SELECT w.id, ew.phonetic_us_normalized
                  FROM word_sense w
              INNER JOIN english_word ew ON ew.id = w.englishId
                  WHERE ew.phonetic_us_normalized IS NOT NULL
                    AND ew.phonetic_us_normalized <> ''
                    AND ${phoneticLenWhere}
                    AND ${spacedWhere};
                `
              : phoneticLenGt !== null
                ? await prisma.$queryRaw<
                    Array<{ id: number; phonetic_us_normalized: string | null }>
                  >`
                    SELECT w.id, ew.phonetic_us_normalized
                    FROM word_sense w
              INNER JOIN english_word ew ON ew.id = w.englishId
                    WHERE ew.phonetic_us_normalized IS NOT NULL
                      AND ew.phonetic_us_normalized <> ''
                      AND ${phoneticLenWhere}
                      AND ${spacedWhere};
                  `
              : await hydrateWordSensesWithEnglishFields(await prisma.wordSense.findMany({
                  where: onlySpaced
                    ? { english: { is: { phonetic_us_normalized: { contains: " " } } } }
                    : undefined,
                  select: { id: true, englishId: true },
            }));

            const wordsById = await loadWordsById(all.map((r) => r.id));
            const statsFilled = await mapWithConcurrency(all, 20, async (row) => {
              if (!row.phonetic_us_normalized)
                return { hasAny: false, hasJob: false, jobEnIsJob: false };

              const word = wordsById.get(row.id);
              if (!word) return { hasAny: false, hasJob: false, jobEnIsJob: false };

              const match = await pickPictureSymbolsForWord(word);

              const hasAny = hasAnyMatchSymbols(match);
              const hasJob = Boolean(match?.job?.fa || match?.job?.en);
              const jobEnIsJob =
                String(match?.job?.en ?? "")
                  .trim()
                  .toLowerCase() === "job";

              return { hasAny, hasJob, jobEnIsJob };
            });

            const matched = statsFilled.filter((s) => s.hasAny).length;
            const noJob = statsFilled.filter((s) => s.hasAny && !s.hasJob).length;
            const jobEnIsJobCount = statsFilled.filter(
              (s) => s.hasJob && s.jobEnIsJob
            ).length;

            return {
              matched,
              empty: all.length - matched,
              total: all.length,
              noJob,
              jobEnIsJob: jobEnIsJobCount,
            };
          })();

    return NextResponse.json({
      page,
      pageSize,
      total: totalForResponse,
      rows: rowsWithMatch,
      matchStats,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
