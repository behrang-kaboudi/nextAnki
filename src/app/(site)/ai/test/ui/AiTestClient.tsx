"use client";

import { useState } from "react";

export function AiTestClient() {
  const [systemPrompt, setSystemPrompt] = useState("Reply with exactly: OK");
  const [userText, setUserText] = useState("test");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string>("");

  const onRun = async () => {
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await fetch("/api/ai/test-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemPrompt, userText }),
      });
      const json = (await res.json()) as { ok?: boolean; output?: string; error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setOutput(String(json.output ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-card bg-card p-6 shadow-elevated">
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-foreground">System prompt</span>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-foreground">User text</span>
        <textarea
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          rows={3}
          spellCheck={false}
          className="w-full rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
        >
          {loading ? "Running…" : "Run"}
        </button>
        <div className="text-sm text-muted">
          Uses `OPENAI_API_KEY` from `.env.local`.
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {output ? (
        <pre className="overflow-auto rounded-xl border border-card bg-background p-3 text-xs text-foreground">
          {output}
        </pre>
      ) : null}
    </div>
  );
}

