"use client";

import { useMemo, useState } from "react";

type Parsed =
  | { ok: true; data: unknown[] }
  | { ok: false; error: string };

function safeJsonArrayParse(input: string): Parsed | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const data = JSON.parse(text) as unknown;
    if (!Array.isArray(data)) return { ok: false, error: "Expected a JSON array" };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function ImageabilityClient() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const parsed = useMemo(() => safeJsonArrayParse(text), [text]);

  const onSubmit = async () => {
    setNotice(null);
    if (!parsed) {
      setNotice("Paste a JSON array first.");
      return;
    }
    if (!parsed.ok) {
      setNotice(`JSON error: ${parsed.error}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/word/imageability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const json = (await res.json()) as
        | {
            requested: number;
            updated: number;
            missing: number;
            missingIds: number[];
            rejectedCount?: number;
            rejected?: Array<{ item: unknown; reason: string }>;
          }
        | { error: string };
      if (!res.ok) throw new Error("error" in json ? json.error : `Request failed (${res.status})`);

      setNotice(
        `Updated: ${json.updated}/${json.requested}. Missing: ${json.missing}${
          typeof json.rejectedCount === "number" ? `, rejected: ${json.rejectedCount}` : ""
        }`
      );
      if (json.missingIds.length > 0) {
        setText(JSON.stringify(json.missingIds.map((id) => ({ id })), null, 2));
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-card bg-card p-6 shadow-elevated">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-foreground">JSON array</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          className="w-full rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
          placeholder='[{"id":1,"sentence_en":"...","sentence_en_meaning_fa":"..."}]'
        />
        {parsed && !parsed.ok ? (
          <div className="text-xs text-red-700">JSON error: {parsed.error}</div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update"}
        </button>

          {notice ? (
            <div className="text-sm text-muted">{notice}</div>
          ) : (
            <div className="text-sm text-muted">
              Each item must include `id` and `sentence_en`. `sentence_en_meaning_fa` is optional. Other fields are ignored.
            </div>
          )}
      </div>
    </div>
  );
}
