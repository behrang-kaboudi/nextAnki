"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { WordAnkiConstants } from "@/lib/AnkiDeck";

const DECKS = [
  { label: "FaToEn", value: WordAnkiConstants.decks.FaToEn },
  { label: "EnToFa", value: WordAnkiConstants.decks.EnToFa },
] as const;

type DeckName = (typeof DECKS)[number]["value"];

type AnkiConnectResponse = {
  result: unknown;
  error: string | null;
};

type SuspendedCardsResult = {
  deckLabel: string;
  deckName: DeckName;
  count: number;
};

function escapeAnkiQueryValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export default function AnkiSuspendManagementClient() {
  const [selectedDeck, setSelectedDeck] = useState<DeckName>(DECKS[0].value);
  const [result, setResult] = useState<SuspendedCardsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function showSuspendedCards() {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/anki-connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "findCards",
          params: {
            query: `deck:"${escapeAnkiQueryValue(selectedDeck)}" is:suspended`,
          },
        }),
      });
      const data = (await response.json()) as AnkiConnectResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "دریافت اطلاعات از Anki ناموفق بود.");
      }
      if (!Array.isArray(data.result)) {
        throw new Error("پاسخ AnkiConnect ساختار مورد انتظار را ندارد.");
      }

      const selected = DECKS.find((deck) => deck.value === selectedDeck);
      setResult({
        deckLabel: selected?.label ?? selectedDeck,
        deckName: selectedDeck,
        count: data.result.length,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "ارتباط با AnkiConnect ناموفق بود.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="AnkiSuspendManagement"
          subtitle="تعداد کارت‌های suspend‌شده در Deck انتخابی"
        />

        <section className="rounded-2xl border border-card bg-background p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1">
              <span className="text-xs font-semibold text-muted">Deck</span>
              <select
                value={selectedDeck}
                onChange={(event) => setSelectedDeck(event.target.value as DeckName)}
                className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              >
                {DECKS.map((deck) => (
                  <option key={deck.value} value={deck.value}>
                    {deck.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void showSuspendedCards()}
              disabled={isLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              {isLoading
                ? "در حال دریافت…"
                : "نمایش کارت‌های suspend‌شده از این Deck"}
            </button>
          </div>

          <div className="mt-4 min-h-32 rounded-xl border border-card bg-black/[0.02] p-4 dark:bg-white/[0.03]">
            {error ? (
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                {error}
              </p>
            ) : result ? (
              <div className="grid gap-2">
                <p className="text-sm text-muted">{result.deckName}</p>
                <p className="text-lg font-semibold text-foreground">
                  تعداد کارت‌های suspend‌شده در {result.deckLabel}: {result.count}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                یک Deck انتخاب کنید و دکمه نمایش را بزنید.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
