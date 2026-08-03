"use client";

import { useEffect, useMemo, useState } from "react";

type RunResult =
  | {
      ok: true;
      done?: boolean;
      output: string;
      item?: {
        id: number;
        base_form: string;
        meaning_fa: string;
      };
      input?: string;
      provider?: "openai" | "gemini";
      usage?: unknown;
      cache?: unknown;
      saved?: {
        id: number;
        base_form: string;
        meaning_fa: string;
        sentence_en: string;
        sentence_en_meaning_fa: string | null;
        other_meanings_fa: string | null;
      } | null;
      parseError?: string;
    }
  | { ok?: false; output?: string; error?: string };

export function SentenceFieldsClient({
  initialPrompt,
  promptPath,
}: {
  initialPrompt: string;
  promptPath: string;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [output, setOutput] = useState("");
  const [selectedItem, setSelectedItem] = useState<{
    id: number;
    base_form: string;
    meaning_fa: string;
  } | null>(null);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState<{
    id: number;
    base_form: string;
    meaning_fa: string;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
    other_meanings_fa: string | null;
  } | null>(null);
  const [usage, setUsage] = useState<unknown>(null);
  const [provider, setProvider] = useState<"openai" | "gemini" | "">( "");
  const [cacheInfo, setCacheInfo] = useState<unknown>(null);
  const [saveNote, setSaveNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkMissing, setBulkMissing] = useState<number | null>(null);
  const [bulkProcessed, setBulkProcessed] = useState(0);
  const [bulkSucceeded, setBulkSucceeded] = useState(0);
  const [bulkFailed, setBulkFailed] = useState(0);
  const [bulkLast, setBulkLast] = useState<string>("");
  const [bulkLog, setBulkLog] = useState<Array<{ t: number; msg: string }>>([]);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  const promptChars = useMemo(() => prompt.length, [prompt]);
  const outputChars = useMemo(() => output.length, [output]);

  const appendBulkLog = (msg: string) => {
    setBulkLog((prev) => {
      const next = [...prev, { t: Date.now(), msg }];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    });
  };

  const refreshCounts = async () => {
    try {
      const res = await fetch("/api/ai/sentence-fields", { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        missingSentenceEn?: number;
        processing?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) return;
      if (typeof json.missingSentenceEn === "number") setBulkMissing(json.missingSentenceEn);
    } catch {
      // ignore
    }
  };

  const onRun = async () => {
    setLoading(true);
    setError("");
    setSaveNote("");
    setOutput("");
    setInput("");
    setSelectedItem(null);
    setSaved(null);
    setUsage(null);
    setProvider("");
    setCacheInfo(null);
    try {
      const res = await fetch("/api/ai/sentence-fields", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "next_missing_sentence_en", provider: "gemini" }),
      });
      const json = (await res.json()) as RunResult;
      if (!res.ok) {
        const err =
          typeof (json as { error?: string })?.error === "string"
            ? (json as { error?: string }).error
            : `Request failed (${res.status})`;
        throw new Error(err);
      }
      if (!(json as { ok?: boolean }).ok) {
        throw new Error(
          typeof (json as { error?: string })?.error === "string"
            ? (json as { error?: string }).error
            : "Unknown error"
        );
      }
      const okJson = json as Extract<RunResult, { ok: true }>;
      setOutput(String(okJson.output ?? ""));
      setInput(String(okJson.input ?? ""));
      setSelectedItem(okJson.item ?? null);
      setSaved(okJson.saved ?? null);
      setUsage(okJson.usage ?? null);
      setProvider(okJson.provider ?? "");
      setCacheInfo(okJson.cache ?? null);
      if (typeof okJson.parseError === "string" && okJson.parseError) {
        setSaveNote(okJson.parseError);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const onRunAll = async () => {
    if (bulkRunning) return;
    setBulkRunning(true);
    setBulkProcessed(0);
    setBulkSucceeded(0);
    setBulkFailed(0);
    setBulkLast("");
    setBulkLog([]);
    await refreshCounts();

    const controller = new AbortController();
    const concurrency = 10;

    const worker = async (idx: number) => {
      while (!controller.signal.aborted) {
        try {
          const res = await fetch("/api/ai/sentence-fields", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "next_missing_sentence_en", provider: "gemini" }),
            signal: controller.signal,
          });
          const json = (await res.json()) as RunResult;

          if (!res.ok) {
            setBulkFailed((x) => x + 1);
            appendBulkLog(`w${idx}: HTTP ${res.status} ${String((json as any)?.error ?? "")}`);
            continue;
          }

          if (!json.ok) {
            setBulkFailed((x) => x + 1);
            appendBulkLog(`w${idx}: ${String((json as any)?.error ?? "unknown error")}`);
            continue;
          }

          if (json.done) {
            appendBulkLog(`w${idx}: done`);
            return;
          }

          setBulkProcessed((x) => x + 1);
          if (json.saved?.id) setBulkSucceeded((x) => x + 1);
          else setBulkFailed((x) => x + 1);

          const usageObj = (json.usage ?? {}) as any;
          const cached = usageObj?.cachedContentTokenCount;
          const total = usageObj?.totalTokenCount;
          const id = json.item?.id ?? json.saved?.id ?? "?";
          setBulkLast(`Word #${id} cached=${cached ?? "?"} total=${total ?? "?"}`);
          appendBulkLog(
            `w${idx}: Word #${id} ${json.saved ? "saved" : "not-saved"} cached=${cached ?? "?"} total=${total ?? "?"}`
          );
        } catch (e) {
          if (controller.signal.aborted) return;
          setBulkFailed((x) => x + 1);
          appendBulkLog(`w${idx}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)));
    } finally {
      controller.abort();
      setBulkRunning(false);
      await refreshCounts();
    }
  };

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-card bg-card p-4 shadow-elevated">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="grid">
            <h2 className="text-sm font-semibold">Prompt (full)</h2>
            <div className="text-xs opacity-60">
              {promptChars.toLocaleString()} chars • {promptPath}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrompt(initialPrompt)}
              className="rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={async () => navigator.clipboard.writeText(prompt)}
              disabled={!prompt.trim()}
              className="rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              Copy
            </button>
          </div>
        </div>

        <textarea
          value={prompt}
          readOnly
          rows={18}
          spellCheck={false}
          className="mt-3 w-full resize-y rounded-xl border border-card bg-background p-3 font-mono text-xs leading-6 text-foreground outline-none"
          placeholder="Prompt…"
        />
      </section>

      <section className="rounded-xl border border-card bg-card p-4 shadow-elevated">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="grid">
            <h2 className="text-sm font-semibold">Output (model)</h2>
            <div className="text-xs opacity-60">
              {outputChars.toLocaleString()} chars
              {selectedItem ? (
                <>
                  {" "}
                  • Word #{selectedItem.id} • {selectedItem.base_form} —{" "}
                  {selectedItem.meaning_fa}
                </>
              ) : null}
              {bulkMissing !== null ? <> • Missing: {bulkMissing}</> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRun}
              disabled={loading || bulkRunning || !prompt.trim()}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Running…" : "Run"}
            </button>
            <button
              type="button"
              onClick={onRunAll}
              disabled={bulkRunning}
              className="inline-flex items-center justify-center rounded-xl border border-card bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-card disabled:opacity-60"
              title="Runs with 10 parallel workers until no more missing sentence_en"
            >
              {bulkRunning ? "Running (10x)…" : "Run All (10x)"}
            </button>
            <button
              type="button"
              onClick={async () => navigator.clipboard.writeText(input)}
              disabled={!input.trim()}
              className="rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card disabled:opacity-60"
            >
              Copy input
            </button>
            <button
              type="button"
              onClick={async () => navigator.clipboard.writeText(output)}
              disabled={!output.trim()}
              className="rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card disabled:opacity-60"
            >
              Copy
            </button>
          </div>
        </div>

        {bulkRunning || bulkProcessed || bulkFailed ? (
          <div className="mt-3 rounded-xl border border-card bg-background p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted">
                Processed: {bulkProcessed} • Saved: {bulkSucceeded} • Failed: {bulkFailed}
              </div>
              <div className="text-xs opacity-70">{bulkLast}</div>
            </div>
            {bulkLog.length ? (
              <pre className="mt-2 max-h-[220px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">
                {bulkLog
                  .map((l) => `${new Date(l.t).toLocaleTimeString()} ${l.msg}`)
                  .join("\n")}
              </pre>
            ) : null}
          </div>
        ) : null}

        {input ? (
          <pre className="mt-3 overflow-auto rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
            {input}
          </pre>
        ) : null}

        {usage ? (
          <div className="mt-3 grid gap-2">
            {provider ? (
              <div className="text-xs opacity-70">Provider: {provider}</div>
            ) : null}
            {cacheInfo ? (
              <pre className="overflow-auto rounded-xl border border-card bg-background p-3 font-mono text-[11px] text-foreground">
                {JSON.stringify({ cache: cacheInfo }, null, 2)}
              </pre>
            ) : null}
            <pre className="overflow-auto rounded-xl border border-card bg-background p-3 font-mono text-[11px] text-foreground">
              {JSON.stringify({ usage }, null, 2)}
            </pre>
          </div>
        ) : null}

        {saved ? (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-800">
            Saved to DB: Word #{saved.id} • {saved.base_form}
          </div>
        ) : saveNote ? (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-900">
            {saveNote}
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <textarea
          value={output}
          readOnly
          rows={18}
          spellCheck={false}
          className="mt-3 w-full resize-y rounded-xl border border-card bg-background p-3 font-mono text-xs leading-6 text-foreground outline-none"
          placeholder="Output will appear here…"
        />

        {saved ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-card bg-background p-3">
            <div className="text-xs font-semibold text-foreground">Saved fields</div>
            <div className="grid gap-1 text-xs">
              <div>
                <span className="font-mono">sentence_en</span>: {saved.sentence_en}
              </div>
              <div>
                <span className="font-mono">sentence_en_meaning_fa</span>:{" "}
                {saved.sentence_en_meaning_fa ?? "null"}
              </div>
              <div>
                <span className="font-mono">other_meanings_fa</span>:{" "}
                {saved.other_meanings_fa ?? "null"}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
