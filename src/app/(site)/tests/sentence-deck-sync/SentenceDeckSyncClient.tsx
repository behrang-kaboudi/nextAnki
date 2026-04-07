"use client";

import { useState } from "react";

import { PageHeader } from "@/components/page-header";

type EnsureResponse =
  | {
      ok: true;
      deckName: string;
      modelName: string;
      fields: string[];
      deckCreated: boolean;
      modelCreated: boolean;
      addedFields: string[];
    }
  | {
      ok: false;
      error: string;
    };

export default function SentenceDeckSyncClient() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<EnsureResponse | null>(null);

  async function handleCreate() {
    if (isRunning) return;

    setIsRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/tests/sentence-deck-sync/ensure", {
        method: "POST",
      });
      const data = (await res.json()) as EnsureResponse;
      setResult(data);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4">
      <div className="grid gap-4">
        <PageHeader
          title="Sentence Cards Management"
          subtitle="Create the sentence deck and note type scaffold in Anki."
        />

        <div className="rounded-2xl border border-card bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted">
              This page currently only ensures the Anki deck <span className="font-mono">enSenteses</span>
              {" "}and the note type <span className="font-mono">enSenteses</span>.
            </div>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isRunning}
              className="rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/5"
            >
              {isRunning ? "در حال ساخت..." : "ساخت"}
            </button>
          </div>

          <div className="mt-4 text-sm opacity-80">
            Fields: <span className="font-mono">sentence_en</span>,{" "}
            <span className="font-mono">sentence_en_sound</span>,{" "}
            <span className="font-mono">sentence_en_meaning_fa</span>,{" "}
            <span className="font-mono">sentence_en_meaning_fa_sound</span>,{" "}
            <span className="font-mono">updatedAt</span>
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-card bg-background p-4 text-sm">
            {result.ok ? (
              <div className="grid gap-2">
                <div className="font-semibold">Operation completed.</div>
                <div>
                  Deck: <span className="font-mono">{result.deckName}</span> | Note type:{" "}
                  <span className="font-mono">{result.modelName}</span>
                </div>
                <div>
                  Deck status: {result.deckCreated ? "created" : "already existed"}
                </div>
                <div>
                  Note type status: {result.modelCreated ? "created" : "already existed"}
                </div>
                <div>
                  Added missing fields:{" "}
                  {result.addedFields.length ? result.addedFields.join(", ") : "none"}
                </div>
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                Error: {result.error}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
