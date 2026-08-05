"use client";

import { useMemo, useState } from "react";

type FieldOption = {
  field: string;
  label: string;
  note?: string;
};

const FIELD_OPTIONS: FieldOption[] = [
  { field: "phonetic_us", label: "phonetic_us" },
  { field: "phonetic_us_normalized", label: "phonetic_us_normalized" },
  { field: "pos", label: "pos" },
  { field: "concept_explained", label: "concept_explained" },
  { field: "concept_explained_fa", label: "concept_explained_fa" },
  { field: "word_hint_story", label: "word_hint_story" },
  {
    field: "explanation_for_sentence_meaning",
    label: "explanation_for_sentence_meaning",
  },
  { field: "learning_depth", label: "learning_depth", note: "set 0" },
  { field: "mixed_sentence", label: "mixed_sentence" },
  { field: "other_meanings_en", label: "other_meanings_en" },
  { field: "category", label: "category" },
  { field: "typeOfWordInDb", label: "typeOfWordInDb" },
  { field: "hint_sentence", label: "hint_sentence" },
  { field: "first_letter_en_hint", label: "first_letter_en_hint" },
  { field: "first_letter_fa_hint", label: "first_letter_fa_hint" },
  { field: "hint_to_select", label: "hint_to_select" },
  { field: "json_hint", label: "json_hint" },
  { field: "word_note", label: "word_note" },
  { field: "common_error", label: "common_error" },
  { field: "imageability", label: "imageability", note: "set 0" },
  { field: "productive_target", label: "productive_target", note: "set 0" },
  { field: "createdAt", label: "createdAt", note: "set 1970-01-01" },
  { field: "updatedAt", label: "updatedAt", note: "set automatically" },
];

export function ClearWordFieldsClient() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    updatedCount: number;
    message: string;
  } | null>(null);

  const selectedFields = useMemo(
    () => FIELD_OPTIONS.map((o) => o.field).filter((f) => Boolean(selected[f])),
    [selected],
  );

  const canSubmit = selectedFields.length > 0 && confirm && !busy;

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(FIELD_OPTIONS.map((o) => [o.field, next])));
  }

  async function runClear() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/tests/word/clear-fields", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields: selectedFields, confirm: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        clearedFields?: string[];
        updatedCount?: number;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }
      setResult({
        updatedCount: Number(json.updatedCount ?? 0),
        message: `Cleared: ${(json.clearedFields ?? []).join(", ") || "—"}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clear Word fields</h1>
          <p className="mt-1 text-sm opacity-80">
            همهٔ فیلدهای جدول <span className="font-mono">Word</span>، به‌جز{" "}
            <span className="font-mono">id</span>،{" "}
            <span className="font-mono">anki_link_id</span> و{" "}
            <span className="font-mono">base_form</span> را می‌توانید برای همهٔ
            رکوردها خالی کنید. متن‌ها خالی، عددها{" "}
            <span className="font-mono">0</span> و{" "}
            <span className="font-mono">createdAt</span> برابر 1970-01-01
            می‌شود؛ <span className="font-mono">updatedAt</span> خودکار به زمان
            اجرای عملیات تغییر می‌کند.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded border bg-yellow-50 px-3 py-2 text-xs text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100">
        این عملیات دیتابیس را برای همهٔ ردیف‌های{" "}
        <span className="font-mono">Word</span> تغییر می‌دهد.
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Clear selection
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded border">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-background">
              <tr className="border-b">
                <th className="w-12 px-3 py-2 font-semibold"> </th>
                <th className="px-3 py-2 font-semibold">field</th>
                <th className="px-3 py-2 font-semibold">note</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_OPTIONS.map((o) => (
                <tr key={o.field} className="border-b">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[o.field])}
                      onChange={(e) =>
                        setSelected((cur) => ({
                          ...cur,
                          [o.field]: e.target.checked,
                        }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-mono">{o.label}</td>
                  <td className="px-3 py-2 text-xs opacity-70">
                    {o.note ?? "—"}
                  </td>
                </tr>
              ))}
              {FIELD_OPTIONS.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-6 text-center text-sm opacity-70"
                  >
                    No fields.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
          />
          <span>I understand this clears values for all records</span>
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void runClear()}
          className="rounded border px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          title={
            selectedFields.length === 0
              ? "Select at least one field"
              : !confirm
                ? "Confirm first"
                : undefined
          }
        >
          {busy ? "Working…" : "Clear selected fields"}
        </button>
      </div>

      <div className="mt-3 text-xs opacity-70">
        Selected:{" "}
        <span className="font-mono">
          {selectedFields.length ? selectedFields.join(", ") : "—"}
        </span>
      </div>

      {error ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30">
          <div className="font-semibold">Error</div>
          <pre className="mt-1 whitespace-pre-wrap break-words">{error}</pre>
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100">
          <div className="font-semibold">OK</div>
          <div className="mt-1">
            <span className="font-mono">{result.message}</span>
          </div>
          <div>
            Updated rows:{" "}
            <span className="font-mono">{result.updatedCount}</span>
          </div>
        </div>
      ) : null}
    </main>
  );
}
