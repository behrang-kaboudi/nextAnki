"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { createAnkiConnectClient } from "@/lib/AnkiConnect/ankiConnect";

type RevlogRow = {
  cardId: number;
  id: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
};

type ReviewsByCard = Record<string, Array<Omit<RevlogRow, "cardId">>>;

function parsePositiveIntsLoose(value: string): number[] {
  const parts = value
    .split(/[^0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean);

  const nums = parts
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  return Array.from(new Set(nums));
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function revlogTypeLabel(t: number) {
  // Anki revlog "type" values vary a bit by scheduler/version; keep it pragmatic.
  switch (t) {
    case 0:
      return "learn";
    case 1:
      return "review";
    case 2:
      return "relearn";
    case 3:
      return "cram";
    default:
      return String(t);
  }
}

function formatReviewDate(id: number) {
  if (!Number.isFinite(id) || id <= 0) return "";
  const d = new Date(id);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export default function AnkiRevlogClient() {
  const client = useMemo(
    () => createAnkiConnectClient({ timeoutMs: 15_000, retryDelayMs: 750 }),
    [],
  );

  const [query, setQuery] = useState('deck:"Default"');
  const [cardIdsText, setCardIdsText] = useState("");
  const [maxCards, setMaxCards] = useState(50);
  const [maxReviewsPerCard, setMaxReviewsPerCard] = useState(50);

  const [isRunning, setIsRunning] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [permissionText, setPermissionText] = useState<string | null>(null);

  const [rows, setRows] = useState<RevlogRow[] | null>(null);
  const [raw, setRaw] = useState<ReviewsByCard | null>(null);

  const parsedCardIds = useMemo(() => parsePositiveIntsLoose(cardIdsText), [cardIdsText]);

  async function requestPermission() {
    setErrorText(null);
    setPermissionText(null);
    const res = await client.requestDetailed("requestPermission");
    if (!res.ok) {
      setErrorText(res.error);
      return;
    }
    const permission = res.result?.permission ?? "unknown";
    setPermissionText(permission);
  }

  async function run() {
    if (isRunning) return;
    setIsRunning(true);
    setErrorText(null);
    setRows(null);
    setRaw(null);

    try {
      const cardLimit = clampInt(maxCards, 1, 5000);
      const reviewLimit = clampInt(maxReviewsPerCard, 1, 5000);

      let cardIds: number[] = [];
      if (parsedCardIds.length > 0) {
        cardIds = parsedCardIds;
      } else {
        const q = query.trim();
        if (!q) {
          setErrorText("Provide either card IDs or a findCards query.");
          return;
        }
        const found = await client.requestDetailed("findCards", { query: q });
        if (!found.ok) {
          setErrorText(found.error);
          return;
        }
        cardIds = (found.result ?? []).slice(0, cardLimit);
      }

      if (cardIds.length === 0) {
        setErrorText("No cards found.");
        return;
      }

      const res = await client.requestDetailed("getReviewsOfCards", { cards: cardIds });
      if (!res.ok) {
        setErrorText(res.error);
        return;
      }

      const byCard = (res.result ?? {}) as ReviewsByCard;
      setRaw(byCard);

      const flattened: RevlogRow[] = [];
      for (const [cardIdStr, reviews] of Object.entries(byCard)) {
        const cardId = Number.parseInt(cardIdStr, 10);
        const list = Array.isArray(reviews) ? reviews : [];
        for (const r of list.slice(0, reviewLimit)) {
          flattened.push({ cardId, ...r });
        }
      }
      flattened.sort((a, b) => b.id - a.id);

      setRows(flattened);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorText(message);
    } finally {
      setIsRunning(false);
    }
  }

  const summary = useMemo(() => {
    const totalRows = rows?.length ?? 0;
    const uniqueCards = rows ? new Set(rows.map((r) => r.cardId)).size : 0;
    return { totalRows, uniqueCards };
  }, [rows]);

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Anki Revlog (AnkiDroid)"
          subtitle="Fetch and display revlog rows via AnkiConnect (getReviewsOfCards)."
        />

        <div className="grid gap-3 rounded-2xl border border-card bg-background p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="text-xs text-muted">
              {permissionText ? (
                <span>
                  Permission: <span className="font-semibold">{permissionText}</span>
                </span>
              ) : (
                <span>Permission: unknown</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              Request permission
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <div className="text-xs font-semibold text-muted">findCards query (Anki search)</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='e.g. deck:"MyDeck" prop:ivl>1'
                className="h-11 w-full rounded-xl border border-card bg-background px-3 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>

            <label className="grid gap-1">
              <div className="text-xs font-semibold text-muted">
                Card IDs (optional, overrides query)
              </div>
              <input
                value={cardIdsText}
                onChange={(e) => setCardIdsText(e.target.value)}
                placeholder="e.g. 1700000000000, 1700000000001"
                className="h-11 w-full rounded-xl border border-card bg-background px-3 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              {parsedCardIds.length > 0 ? (
                <div className="text-xs opacity-70">Parsed {parsedCardIds.length} card IDs.</div>
              ) : null}
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1">
              <div className="text-xs font-semibold text-muted">Max cards</div>
              <input
                type="number"
                value={maxCards}
                onChange={(e) => setMaxCards(Number(e.target.value))}
                min={1}
                max={5000}
                className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>

            <label className="grid gap-1">
              <div className="text-xs font-semibold text-muted">Max reviews per card</div>
              <input
                type="number"
                value={maxReviewsPerCard}
                onChange={(e) => setMaxReviewsPerCard(Number(e.target.value))}
                min={1}
                max={5000}
                className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={isRunning}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "Loading…" : "Fetch revlog"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorText(null);
                  setRows(null);
                  setRaw(null);
                }}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                Clear
              </button>
            </div>
          </div>

          {errorText ? <div className="text-sm font-semibold text-red-700">{errorText}</div> : null}

          {rows ? (
            <div className="text-xs text-muted">
              Rows: <span className="font-semibold">{summary.totalRows}</span> — Cards:{" "}
              <span className="font-semibold">{summary.uniqueCards}</span>
            </div>
          ) : null}
        </div>

        {rows ? (
          <div className="overflow-hidden rounded-2xl border border-card bg-background">
            <div className="overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-card">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">Reviewed at</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">cardId</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">ease</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">ivl</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">lastIvl</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">factor</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">time(ms)</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">type</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">revlogId</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.cardId}:${r.id}`} className="border-b border-card">
                      <td className="whitespace-nowrap px-3 py-2 font-mono opacity-90">
                        {formatReviewDate(r.id)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">{r.cardId}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.ease}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.ivl}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.lastIvl}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.factor}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.time}</td>
                      <td className="whitespace-nowrap px-3 py-2">{revlogTypeLabel(r.type)}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono opacity-80">{r.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {raw ? (
          <details className="rounded-2xl border border-card bg-background p-4">
            <summary className="cursor-pointer text-sm font-semibold">Raw JSON</summary>
            <pre className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-card bg-black/5 p-3 text-xs text-foreground dark:bg-white/5">
              {JSON.stringify(raw, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </main>
  );
}

