"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: number;
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
  hint_sentence: string | null;
  json_hint: string | null;
  json_hint_generated_at_ms: number | null;
};

type PreviewItem = {
  id: number;
  prevJson: string | null;
  nextJson: string | null;
  changed: boolean;
};
type AllChangedItem = Row & {
  prevJson: string | null;
  nextJson: string | null;
  changed: boolean;
};

function previewText(value: string | null, max = 72) {
  const s = (value ?? "").trim();
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export default function WordHintsTable({ rows }: { rows: Row[] }) {
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, PreviewItem>>({});
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [viewAllChanged, setViewAllChanged] = useState(false);
  const [allChanged, setAllChanged] = useState<AllChangedItem[]>([]);
  const [allCursorId, setAllCursorId] = useState<number>(0);
  const [allDone, setAllDone] = useState(false);
  const [allLoading, setAllLoading] = useState(false);
  const [allProcessed, setAllProcessed] = useState(0);
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [allCurrentId, setAllCurrentId] = useState<number | null>(null);

  async function runPreview(ids: number[]) {
    if (ids.length === 0) return;
    setOnlyChanged(true);
    setError(null);
    setBusyIds((cur) =>
      Object.fromEntries([
        ...Object.entries(cur),
        ...ids.map((id) => [String(id), true]),
      ]),
    );
    try {
      const res = await fetch("/api/words/json-hint-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: PreviewItem[];
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      const items = Array.isArray(json.items) ? json.items : [];
      setPreview((cur) => {
        const next = { ...cur };
        for (const it of items) next[String(it.id)] = it;
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyIds((cur) => {
        const next = { ...cur };
        for (const id of ids) delete next[String(id)];
        return next;
      });
    }
  }

  const changedCount = useMemo(
    () => Object.values(preview).filter((p) => p.changed).length,
    [preview],
  );

  async function loadAllChanged({ reset }: { reset: boolean }) {
    if (allLoading) return;

    setAllLoading(true);
    setError(null);
    try {
      const cursorId = reset ? 0 : allCursorId;
      const url = new URL(
        "/api/words/json-hint-preview-all",
        window.location.origin,
      );
      url.searchParams.set("cursorId", String(cursorId));
      url.searchParams.set("takeChanged", "5");
      url.searchParams.set("scanBatch", "10");
      if (reset) url.searchParams.set("includeTotal", "1");

      const res = await fetch(url.toString(), { method: "GET" });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: (AllChangedItem & {
          prevJson?: string | null;
          nextJson?: string | null;
        })[];
        nextCursorId?: number;
        processed?: number;
        total?: number | null;
        currentId?: number;
        done?: boolean;
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      const items = Array.isArray(json.items) ? json.items : [];
      const nextCursorId =
        typeof json.nextCursorId === "number" ? json.nextCursorId : cursorId;
      const processed =
        typeof json.processed === "number" && Number.isFinite(json.processed)
          ? json.processed
          : 0;
      const total =
        typeof json.total === "number" && Number.isFinite(json.total)
          ? json.total
          : null;
      const currentId =
        typeof json.currentId === "number" && Number.isFinite(json.currentId)
          ? json.currentId
          : null;
      const done = Boolean(json.done);

      setAllCursorId(nextCursorId);
      setAllDone(done);
      setAllProcessed((cur) => (reset ? processed : cur + processed));
      if (reset) setAllTotal(total);
      setAllCurrentId(currentId);
      setAllChanged((cur) => (reset ? items : [...cur, ...items]));

      setPreview((cur) => {
        const next = reset ? {} : { ...cur };
        for (const it of items) {
          next[String(it.id)] = {
            id: it.id,
            prevJson: it.prevJson ?? null,
            nextJson: it.nextJson ?? null,
            changed: true,
          };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAllLoading(false);
    }
  }

  useEffect(() => {
    if (!viewAllChanged) return;
    if (allLoading || allDone) return;
    const t = setTimeout(() => {
      void loadAllChanged({ reset: false });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone, allLoading, viewAllChanged]);

  const activeRows = viewAllChanged ? allChanged : rows;

  const visibleRows = useMemo(() => {
    if (!onlyChanged) return activeRows;
    return activeRows.filter((r) => Boolean(preview[String(r.id)]?.changed));
  }, [activeRows, onlyChanged, preview]);

  return (
    <>
      <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
        <label className="flex select-text items-center gap-2 text-xs opacity-80">
          <input
            type="checkbox"
            checked={viewAllChanged}
            onChange={(e) => {
              const checked = e.target.checked;
              setViewAllChanged(checked);
              setOnlyChanged(checked);
              if (checked) {
                setAllChanged([]);
                setAllCursorId(0);
                setAllDone(false);
                setAllProcessed(0);
                setAllTotal(null);
                setAllCurrentId(null);
                void loadAllChanged({ reset: true });
              } else {
                setAllChanged([]);
                setAllCursorId(0);
                setAllDone(false);
                setAllProcessed(0);
                setAllTotal(null);
                setAllCurrentId(null);
              }
            }}
            disabled={allLoading}
          />
          Show only changed (ALL DB)
        </label>
        {changedCount ? (
          <span className="text-xs opacity-70">Changed: {changedCount}</span>
        ) : null}
        {viewAllChanged ? (
          <span className="text-xs opacity-70">
            Loaded: {allChanged.length} • Scanned: {allProcessed}
            {allTotal !== null ? `/${allTotal}` : null}
            {allCurrentId !== null ? ` • currentId=${allCurrentId}` : null}
            {allDone ? " • done" : null}
            {allLoading ? " • loading…" : null}
          </span>
        ) : null}
        {error ? (
          <div className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30">
            <div className="font-semibold">Error</div>
            <pre className="mt-1 whitespace-pre-wrap break-words">{error}</pre>
          </div>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded border">
        <div className="overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b">
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  id
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  base_form
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  meaning_fa
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  hint_sentence
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  json_hint
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  json_hint (preview)
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold">
                  preview
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const p = preview[String(r.id)];
                const changed = Boolean(p?.changed);
                return (
                  <tr
                    key={r.id}
                    className={changed ? "border-b bg-yellow-50" : "border-b"}
                  >
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {r.id}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.base_form}
                    </td>
                    <td
                      className="max-w-[520px] truncate px-3 py-2"
                      title={r.meaning_fa}
                    >
                      {r.meaning_fa}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.hint_sentence ?? "—"}
                    </td>
                    <td
                      className="max-w-[460px] truncate px-3 py-2 font-mono"
                      title={r.json_hint ?? ""}
                    >
                      {previewText(r.json_hint)}
                    </td>
                    <td
                      className="max-w-[460px] truncate px-3 py-2 font-mono"
                      title={changed ? (p?.nextJson ?? "") : ""}
                    >
                      {changed ? previewText(p?.nextJson ?? null) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void runPreview([r.id])}
                        disabled={Boolean(busyIds[String(r.id)])}
                        className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                        title="Compute preview for this row (no DB updates)"
                      >
                        {busyIds[String(r.id)] ? "…" : "Preview"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-sm opacity-70"
                  >
                    No rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
