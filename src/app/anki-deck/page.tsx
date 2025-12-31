"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { actionRunScan } from "./actions";
import { WordAnkiConstants } from "@/lib/AnkiDeck/constants";

type DevLogItem = {
  title: string;
  done: boolean;
};

const devLog: DevLogItem[] = [];

export default function AnkiDeckPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOutput, setDevOutput] = useState<string[]>([]);

  const requiredDecks = useMemo(
    () => [
      WordAnkiConstants.decks.root,
      WordAnkiConstants.decks.EnToFa,
      WordAnkiConstants.decks.FaToEn,
      WordAnkiConstants.decks.Emla,
    ],
    []
  );

  async function handleScanEnToFaDueInOneMonth() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await actionRunScan();
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const { emla, faToEn } = res.value;

      setDevOutput((prev) => [
        `EnToFa notes due > ${emla.dueAfterDays}d: ${emla.sourceNoteIds.length}.`,
        `Emla cards matched: ${emla.emlaCardIdsMatched.length}.`,
        `Emla cards (new only): ${emla.emlaCardIdsNew.length}.`,
        `Emla pressed "Again" once: ${emla.answeredAgainCardIds.length}.`,
        `Emla failed: ${emla.failedCardIds.length}.`,
        `EnToFa cards due > ${faToEn.dueAfterDays}d: ${faToEn.sourceCardIds.length}.`,
        `FaToEn new cards matched: ${faToEn.targetNewCardIdsMatched.length}.`,
        `FaToEn pressed "Again" once: ${faToEn.answeredAgainCardIds.length}.`,
        `FaToEn failed: ${faToEn.failedCardIds.length}.`,
        ...prev,
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Word Deck Management"
        subtitle="AnkiConnect must be running (port 8765)."
      />

      <section className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <div className="text-sm font-semibold text-foreground">
              Required decks
            </div>
            <div className="text-xs text-muted">
              Root:{" "}
              <span className="font-mono">{WordAnkiConstants.decks.root}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleScanEnToFaDueInOneMonth}
              disabled={isLoading}
              className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              {isLoading ? "..." : "Scan EnToFa due > (30d && > 15d)"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {requiredDecks.map((name) => (
            <div
              key={name}
              className="rounded-xl border border-card bg-background p-3"
            >
              <div className="text-xs font-semibold text-muted">Deck</div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="text-sm font-semibold text-foreground">Dev Log</div>
        <div className="mt-3 grid gap-2">
          {devLog.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-card bg-background p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-foreground">{item.title}</div>
                <div className="text-xs text-muted">
                  {item.done ? "Done" : "Todo"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {devOutput.length ? (
          <div className="mt-4 grid gap-2">
            {devOutput.map((line, index) => (
              <div
                key={`${index}-${line}`}
                className="rounded-xl border border-card bg-background p-3"
              >
                <div className="font-mono text-xs text-muted">{line}</div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
