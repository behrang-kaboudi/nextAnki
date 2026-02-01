"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";

type AnkiConnectProxyResponse = {
  result: unknown;
  error: string | null;
};

function safeJsonParse(value: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AnkiConnectPlaygroundClient() {
  const [action, setAction] = useState("findCards");
  const [paramsText, setParamsText] = useState('{\n  "query": "deck:\\"WordsForNewStudy::Rahnama\\" prop:ivl>1"\n}');
  const [requestText, setRequestText] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const parsedParams = useMemo(() => safeJsonParse(paramsText), [paramsText]);

  async function run() {
    if (isRunning) return;
    setIsRunning(true);
    setErrorText(null);

    try {
      if (!action.trim()) {
        setErrorText("Action is required.");
        return;
      }
      if (!parsedParams.ok) {
        setErrorText(`Invalid params JSON: ${parsedParams.error}`);
        return;
      }

      const payload = { action: action.trim(), params: parsedParams.value };
      setRequestText(prettyJson(payload));
      setResponseText(null);

      const res = await fetch("/api/anki-connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as AnkiConnectProxyResponse;
      setResponseText(prettyJson(data));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorText(message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-col gap-4">
        <PageHeader
          title="AnkiConnect Playground"
          subtitle="Send raw AnkiConnect requests and see the full JSON response."
        />

        <div className="grid gap-3 rounded-2xl border border-card bg-background p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <div className="text-xs font-semibold text-muted">Action</div>
              <input
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder='e.g. findCards, findNotes, cardsInfo, deckNames, sync'
                className="h-11 w-full rounded-xl border border-card bg-background px-3 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>

            <div className="flex items-end justify-start gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={isRunning}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "Sending…" : "Send"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequestText(null);
                  setResponseText(null);
                  setErrorText(null);
                }}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                Clear
              </button>
            </div>
          </div>

          <label className="grid gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-muted">Params (JSON)</div>
              {!parsedParams.ok ? (
                <div className="text-xs font-semibold text-red-700">Invalid JSON</div>
              ) : null}
            </div>
            <textarea
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full rounded-xl border border-card bg-background p-3 font-mono text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>

          {errorText ? <div className="text-sm font-semibold text-red-700">{errorText}</div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 rounded-2xl border border-card bg-background p-4">
            <div className="text-xs font-semibold text-muted">Request</div>
            <pre className="min-h-[220px] overflow-auto rounded-xl border border-card bg-black/5 p-3 text-xs text-foreground dark:bg-white/5">
              {requestText ?? ""}
            </pre>
          </div>

          <div className="grid gap-2 rounded-2xl border border-card bg-background p-4">
            <div className="text-xs font-semibold text-muted">Response</div>
            <pre className="min-h-[220px] overflow-auto rounded-xl border border-card bg-black/5 p-3 text-xs text-foreground dark:bg-white/5">
              {responseText ?? ""}
            </pre>
          </div>
        </div>
      </div>
    </main>
  );
}

