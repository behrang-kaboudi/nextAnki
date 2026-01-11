"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

type PictureWordRow = {
  id: number;
  fa: string;
  ipa_fa: string;
  phinglish: string;
  en: string;
  type:
    | "noun"
    | "adding"
    | "animal"
    | "person"
    | "occupation"
    | "notPersonal"
    | "humanBody"
    | "relationalObj"
    | "personAdj"
    | "personAdj_adj"
    | "adj"
    | "food"
    | "place"
    | "accessory"
    | "tool"
    | "sport";
  usage: "Job" | "adj" | "person" | "free" | "notSet";
  canBePersonal: boolean;
  canImagineAsHuman: boolean;
  canUseAsHumanAdj: boolean;
  ipaVerified: boolean;
};

const USAGE_VALUES: Array<PictureWordRow["usage"]> = [
  "Job",
  "adj",
  "person",
  "free",
  "notSet",
];

type PictureWordUpdateField =
  | "type"
  | "usage"
  | "canBePersonal"
  | "canImagineAsHuman"
  | "canUseAsHumanAdj";

const UPDATE_FIELD_LABELS: Record<PictureWordUpdateField, string> = {
  type: "type",
  usage: "usage",
  canBePersonal: "canBePersonal",
  canImagineAsHuman: "canImagineAsHuman",
  canUseAsHumanAdj: "canUseAsHumanAdj",
};

type BulkUpdateField =
  | "type"
  | "usage"
  | "canBePersonal"
  | "canImagineAsHuman"
  | "canUseAsHumanAdj"
  | "ipaVerified"
  | "fa"
  | "en"
  | "ipa_fa"
  | "ipa_fa_normalized"
  | "phinglish";

const BULK_UPDATE_FIELDS: Array<{ value: BulkUpdateField; label: string }> = [
  { value: "type", label: "type" },
  { value: "usage", label: "usage" },
  { value: "canBePersonal", label: "canBePersonal" },
  { value: "canImagineAsHuman", label: "canImagineAsHuman" },
  { value: "canUseAsHumanAdj", label: "canUseAsHumanAdj" },
  { value: "ipaVerified", label: "ipaVerified" },
  { value: "fa", label: "fa" },
  { value: "en", label: "en" },
  { value: "ipa_fa", label: "ipa_fa" },
  { value: "ipa_fa_normalized", label: "ipa_fa_normalized" },
  { value: "phinglish", label: "phinglish" },
];

const BULK_TYPE_VALUES: PictureWordRow["type"][] = [
  "noun",
  "adding",
  "animal",
  "person",
  "occupation",
  "notPersonal",
  "humanBody",
  "relationalObj",
  "personAdj",
  "personAdj_adj",
  "adj",
  "food",
  "place",
  "accessory",
  "tool",
  "sport",
];

function normalizeJsonish(input: string) {
  let text = input.trim();
  if (!text) return text;

  text = text.replace(/\/\/.*$/gm, "");
  text = text.replace(/\/\*[\s\S]*?\*\//g, "");
  text = text.replace(/,\s*([}\]])/g, "$1");
  text = text.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  text = text.replace(/'/g, '"');
  return text.trim();
}

function safeJsonParse(
  value: string
):
  | { ok: true; data: unknown; normalized: string; didNormalize: boolean }
  | { ok: false; error: string } {
  try {
    return {
      ok: true,
      data: JSON.parse(value),
      normalized: value,
      didNormalize: false,
    };
  } catch (e) {
    const normalized = normalizeJsonish(value);
    if (normalized && normalized !== value) {
      try {
        return {
          ok: true,
          data: JSON.parse(normalized),
          normalized,
          didNormalize: true,
        };
      } catch (e2) {
        return {
          ok: false,
          error: e2 instanceof Error ? e2.message : String(e2),
        };
      }
    }

    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function parseIdArray(input: string):
  | { ok: true; ids: number[] }
  | { ok: false; error: string } {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "IDs is required." };

  if (raw.startsWith("[") || raw.startsWith("{")) {
    const parsed = safeJsonParse(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (!Array.isArray(parsed.data))
      return { ok: false, error: "IDs must be a JSON array." };
    const ids = parsed.data
      .map((x) => (typeof x === "number" ? x : Number(x)))
      .filter((x) => Number.isFinite(x) && x > 0);
    const unique = Array.from(new Set(ids));
    if (!unique.length) return { ok: false, error: "No valid IDs found." };
    return { ok: true, ids: unique };
  }

  const ids = raw
    .split(/[\s,]+/g)
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0);
  const unique = Array.from(new Set(ids));
  if (!unique.length) return { ok: false, error: "No valid IDs found." };
  return { ok: true, ids: unique };
}

const ImportSidebar = memo(function ImportSidebar({
  text,
  setText,
  parsed,
  loading,
  notice,
  onImport,
  onTextFocus,
}: {
  text: string;
  setText: (value: string) => void;
  parsed: ReturnType<typeof safeJsonParse> | null;
  loading: boolean;
  notice: string | null;
  onImport: (options: { updateFields: PictureWordUpdateField[] }) => void;
  onTextFocus: (element: HTMLTextAreaElement) => void;
}) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptNotice, setPromptNotice] = useState<string | null>(null);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkIdsText, setBulkIdsText] = useState("");
  const [bulkField, setBulkField] = useState<BulkUpdateField>("type");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkTypeValue, setBulkTypeValue] =
    useState<PictureWordRow["type"]>("noun");
  const [bulkBooleanValue, setBulkBooleanValue] = useState<"true" | "false">(
    "true"
  );
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [updateFields, setUpdateFields] = useState<PictureWordUpdateField[]>([
    "type",
    "canBePersonal",
  ]);

  const loadPrompt = useCallback(async () => {
    setPromptLoading(true);
    setPromptError(null);
    setPromptNotice(null);
    try {
      const response = await fetch("/api/prompts/physical-object-vocabulary", {
        cache: "no-store",
      });
      const data = (await response.json()) as { text?: string; error?: string };
      if (!response.ok)
        throw new Error(data.error || `Request failed (${response.status})`);
      setPromptText(data.text ?? "");
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromptLoading(false);
    }
  }, []);

  const savePrompt = useCallback(async () => {
    setPromptLoading(true);
    setPromptError(null);
    setPromptNotice(null);
    try {
      const response = await fetch("/api/prompts/physical-object-vocabulary", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: promptText }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok)
        throw new Error(data.error || `Request failed (${response.status})`);
      setPromptNotice("Updated.");
    } catch (e) {
      setPromptError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromptLoading(false);
    }
  }, [promptText]);

  const submitBulkUpdate = useCallback(async () => {
    if (bulkLoading) return;
    setBulkError(null);
    setBulkNotice(null);
    const parsed = parseIdArray(bulkIdsText);
    if (!parsed.ok) {
      setBulkError(parsed.error);
      return;
    }

    const value =
      bulkField === "type"
        ? bulkTypeValue
        : bulkField === "canBePersonal" ||
            bulkField === "canImagineAsHuman" ||
            bulkField === "canUseAsHumanAdj" ||
            bulkField === "ipaVerified"
          ? bulkBooleanValue === "true"
          : bulkValue;

    if (
      bulkField !== "type" &&
      bulkField !== "canBePersonal" &&
      bulkField !== "canImagineAsHuman" &&
      bulkField !== "canUseAsHumanAdj" &&
      bulkField !== "ipaVerified"
    ) {
      if (!String(value ?? "").trim()) {
        setBulkError("Value is required.");
        return;
      }
    }

    setBulkLoading(true);
    try {
      const response = await fetch("/api/ipa/picture-words/bulk-update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: parsed.ids, field: bulkField, value }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        updatedCount?: number;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || `Request failed (${response.status})`);
      setBulkNotice(`Updated ${data.updatedCount ?? 0} record(s).`);
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkLoading(false);
    }
  }, [
    bulkBooleanValue,
    bulkField,
    bulkIdsText,
    bulkLoading,
    bulkTypeValue,
    bulkValue,
  ]);

  return (
    <aside className="h-fit rounded-2xl border border-card bg-card p-4 shadow-elevated">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-foreground">Import</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsBulkUpdateOpen(true)}
            className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            Update by IDs
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPromptOpen(true);
              void loadPrompt();
            }}
            className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            Prompt
          </button>
        </div>
      </div>
      <div className="mt-1 text-sm text-muted">
        Paste a JSON array of <code className="font-mono">PictureWord</code>{" "}
        objects.
      </div>

      <div className="mt-4 rounded-2xl border border-card bg-background p-3">
        <div className="text-sm font-semibold text-foreground">
          Update fields
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-foreground/80">
          {(Object.keys(UPDATE_FIELD_LABELS) as PictureWordUpdateField[]).map(
            (field) => (
              <label key={field} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={updateFields.includes(field)}
                  onChange={(e) => {
                    setUpdateFields((prev) => {
                      if (e.target.checked)
                        return [...new Set([...prev, field])];
                      return prev.filter((x) => x !== field);
                    });
                  }}
                />
                <span className="font-mono text-xs">
                  {UPDATE_FIELD_LABELS[field]}
                </span>
              </label>
            )
          )}
        </div>
        {updateFields.length === 0 ? (
          <div className="mt-2 text-xs text-red-700">
            Select at least one field to update.
          </div>
        ) : null}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => onTextFocus(e.currentTarget)}
        rows={16}
        className="mt-3 w-full resize-y rounded-xl border border-card bg-background px-3 py-2 font-mono text-xs text-foreground"
        placeholder='[\n  { "fa": "اژدها", "ipa_fa": "eʒdɑːhɑː", "phinglish": "ezhdaha", "en": "dragon" }\n]'
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onImport({ updateFields })}
          disabled={loading || updateFields.length === 0}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
        >
          Import / Update
        </button>
      </div>

      {parsed && !parsed.ok ? (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700">
          JSON error: {parsed.error}
        </div>
      ) : parsed && parsed.didNormalize ? (
        <div className="mt-3 rounded-xl border border-card bg-background p-3 text-xs text-muted">
          Input looks like JS object syntax; it will be auto-normalized to valid
          JSON on import.
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded-xl border border-card bg-background p-3 text-sm text-foreground">
          {notice}
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-card bg-[linear-gradient(135deg,rgba(37,99,235,0.10),rgba(236,72,153,0.08))] p-4">
        <div className="text-base font-semibold text-foreground">Guide</div>
        <div className="mt-2 grid gap-3 text-[1.05rem] text-foreground/80">
          <div>
            <div className="font-medium text-foreground">Input format</div>
            <div className="mt-1">
              Paste a JSON array (or JS-like object syntax; it will be
              auto-normalized). Each item with an{" "}
              <code className="font-mono">id</code> will update that row. If{" "}
              <code className="font-mono">id</code> is missing but{" "}
              <code className="font-mono">fa</code> matches an existing row, it
              will update that row (only when the match is unambiguous).
            </div>
          </div>

          <div>
            <div className="font-medium text-foreground">Required fields</div>
            <div className="mt-1 font-mono text-sm text-foreground/70">
              {`{ "fa": "...", "ipa_fa": "...", "phinglish": "...", "en": "...", "type"?: "noun" | "adding" }`}
            </div>
            <div className="mt-1">
              <code className="font-mono">type</code> is optional and defaults
              to <code className="font-mono">noun</code>.
            </div>
          </div>

          <div>
            <div className="font-medium text-foreground">Validation</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/80">
              <li>
                In <code className="font-mono">fa</code>, half-space (ZWNJ) is
                converted to a normal space.
              </li>
              <li>
                If <code className="font-mono">fa</code> contains non-Persian
                characters (except spaces), that item is rejected and will not
                be imported.
              </li>
              <li>
                If any items are rejected, the textarea will show the rejected
                list with a <code className="font-mono">reason</code>.
              </li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-foreground">After import</div>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground/80">
              <li>The table refreshes automatically.</li>
              <li>
                Records are unique by <code className="font-mono">fa + en</code>
                ; duplicates are skipped.
              </li>
            </ul>
          </div>

          <div>
            <div className="font-medium text-foreground">Verify workflow</div>
            <div className="mt-1">
              Edit <code className="font-mono">ipa</code> and{" "}
              <code className="font-mono">phinglish</code> inline, then click{" "}
              <code className="font-mono">Verify</code> to save changes and mark{" "}
              <code className="font-mono">ipaVerified=true</code>. Use{" "}
              <code className="font-mono">Unverified only</code> to focus on
              pending items.
            </div>
          </div>
        </div>
      </div>

      {isPromptOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsPromptOpen(false)}
        >
          <div
            className="mx-auto mt-10 flex h-[80vh] w-[min(92vw,60rem)] flex-col rounded-2xl border border-card bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold text-foreground">
                  Prompt
                </div>
                <div className="text-sm text-muted">
                  <code className="font-mono">
                    src/prompts/others/physical-object-vocabulary.md
                  </code>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPromptOpen(false)}
                className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
              >
                Close
              </button>
            </div>

            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="mt-4 min-h-0 w-full flex-1 resize-none rounded-xl border border-card bg-background px-3 py-2 font-mono text-xs text-foreground"
            />

            {promptError ? (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                {promptError}
              </div>
            ) : null}
            {promptNotice ? (
              <div className="mt-3 rounded-xl border border-card bg-background p-3 text-sm text-foreground">
                {promptNotice}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void loadPrompt()}
                disabled={promptLoading}
                className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:opacity-60"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => void savePrompt()}
                disabled={promptLoading}
                className="rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isBulkUpdateOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={() => setIsBulkUpdateOpen(false)}
        >
          <div
            className="mx-auto mt-10 flex w-[min(92vw,46rem)] flex-col rounded-2xl border border-card bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-lg font-semibold text-foreground">
                  Update by IDs
                </div>
                <div className="text-sm text-muted">
                  Updates selected <code className="font-mono">PictureWord</code>{" "}
                  rows.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkUpdateOpen(false)}
                className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <div className="text-sm font-semibold text-foreground">Field</div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkField}
                    onChange={(e) => setBulkField(e.target.value as BulkUpdateField)}
                    className="h-9 rounded-xl border border-card bg-background px-3 text-sm text-foreground"
                    disabled={bulkLoading}
                  >
                    {BULK_UPDATE_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  {bulkField === "type" ? (
                    <select
                      value={bulkTypeValue}
                      onChange={(e) =>
                        setBulkTypeValue(e.target.value as PictureWordRow["type"])
                      }
                      className="h-9 min-w-48 rounded-xl border border-card bg-background px-3 text-sm text-foreground"
                      disabled={bulkLoading}
                    >
                      {BULK_TYPE_VALUES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : bulkField === "canBePersonal" ||
                    bulkField === "canImagineAsHuman" ||
                    bulkField === "canUseAsHumanAdj" ||
                    bulkField === "ipaVerified" ? (
                    <select
                      value={bulkBooleanValue}
                      onChange={(e) =>
                        setBulkBooleanValue(e.target.value as "true" | "false")
                      }
                      className="h-9 min-w-32 rounded-xl border border-card bg-background px-3 text-sm text-foreground"
                      disabled={bulkLoading}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      className="h-9 min-w-64 flex-1 rounded-xl border border-card bg-background px-3 text-sm text-foreground"
                      placeholder="Value…"
                      disabled={bulkLoading}
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold text-foreground">
                  PictureWord IDs
                </div>
                <textarea
                  value={bulkIdsText}
                  onChange={(e) => setBulkIdsText(e.target.value)}
                  rows={6}
                  className="w-full resize-y rounded-xl border border-card bg-background px-3 py-2 font-mono text-xs text-foreground"
                  placeholder={"[1, 2, 3]\n\nor: 1,2,3"}
                  disabled={bulkLoading}
                />
              </div>

              {bulkError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                  {bulkError}
                </div>
              ) : null}
              {bulkNotice ? (
                <div className="rounded-xl border border-card bg-background p-3 text-sm text-foreground">
                  {bulkNotice}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void submitBulkUpdate()}
                  disabled={bulkLoading}
                  className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                >
                  {bulkLoading ? "Updating…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
});

export function PictureWordsClient() {
  const [importText, setImportText] = useState("");
  const [rows, setRows] = useState<PictureWordRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableNotice, setTableNotice] = useState<string | null>(null);
  const [lastChangedRow, setLastChangedRow] = useState<PictureWordRow | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [showUnverifiedOnly, setShowUnverifiedOnly] = useState(false);
  const [showNotSetUsageOnly, setShowNotSetUsageOnly] = useState(false);
  const [searchIpaOnly, setSearchIpaOnly] = useState(false);
  const [showDuplicateFaOnly, setShowDuplicateFaOnly] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<
      number,
      {
        fa: string;
        ipa_fa: string;
        phinglish: string;
        usage: PictureWordRow["usage"];
        canBePersonal: boolean;
        canImagineAsHuman: boolean;
        canUseAsHumanAdj: boolean;
      }
    >
  >({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [activeField, setActiveField] = useState<
    | { kind: "draft"; id: number; field: "fa" | "ipa_fa" | "phinglish" }
    | { kind: "search" }
    | { kind: "import" }
    | null
  >(null);
  const lastFocusedInputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);
  const [sort, setSort] = useState<{
    key: "fa" | "type";
    dir: "asc" | "desc";
  } | null>(null);

  const parsed = useMemo(() => {
    if (!importText.trim()) return null;
    return safeJsonParse(importText);
  }, [importText]);

  const fetchRows = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);
    try {
      const response = await fetch("/api/ipa/picture-words", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as { rows: PictureWordRow[] };
      setRows(data.rows);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const row of data.rows) {
          if (!next[row.id]) {
            next[row.id] = {
              fa: row.fa,
              ipa_fa: row.ipa_fa,
              phinglish: row.phinglish,
              usage: row.usage,
              canBePersonal: row.canBePersonal,
              canImagineAsHuman: row.canImagineAsHuman,
              canUseAsHumanAdj: row.canUseAsHumanAdj,
            };
          }
        }
        return next;
      });
    } catch (e) {
      setTableError(e instanceof Error ? e.message : String(e));
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const onImport = useCallback(
    async (options: { updateFields: PictureWordUpdateField[] }) => {
      setImportNotice(null);

      if (!parsed) {
        setImportNotice("Paste a JSON array first.");
        return;
      }
      if (!parsed.ok) {
        setImportNotice(`JSON error: ${parsed.error}`);
        return;
      }
      if (!options.updateFields.length) {
        setImportNotice("Select at least one update field.");
        return;
      }

      setImportLoading(true);
      try {
        const response = await fetch("/api/ipa/picture-words", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            items: parsed.data,
            updateFields: options.updateFields,
          }),
        });
        const data = (await response.json()) as
          | {
              inserted: number;
              updated?: number;
              unchanged?: number;
              skipped: number;
              total: number;
              prepared?: number;
              rejected?: Array<{ item: unknown; reason: string }>;
            }
          | { error: string };

        if (!response.ok) {
          const msg =
            "error" in data
              ? data.error
              : `Request failed (${response.status})`;
          throw new Error(msg);
        }

        if (!("inserted" in data)) {
          throw new Error("Unexpected response from server.");
        }

        const rejected = Array.isArray(data.rejected) ? data.rejected : [];
        const preparedText =
          "prepared" in data ? `, prepared: ${data.prepared}` : "";
        const updatedText =
          "updated" in data && typeof data.updated === "number"
            ? `, updated: ${data.updated}`
            : "";
        const unchangedText =
          "unchanged" in data && typeof data.unchanged === "number"
            ? `, unchanged: ${data.unchanged}`
            : "";
        const normalizedText = parsed.didNormalize
          ? " (auto-normalized input)"
          : "";
        setImportNotice(
          `Imported. inserted: ${data.inserted}${updatedText}${unchangedText}, skipped: ${data.skipped}, rejected: ${rejected.length}${preparedText}${normalizedText}`
        );
        if (rejected.length > 0) {
          setImportText(JSON.stringify(rejected, null, 2));
        } else {
          setImportText("");
        }
        await fetchRows();
      } catch (e) {
        setImportNotice(e instanceof Error ? e.message : String(e));
      } finally {
        setImportLoading(false);
      }
    },
    [fetchRows, parsed]
  );

  const onDelete = useCallback(
    async (row: PictureWordRow) => {
      if (!confirm(`Delete "${row.fa}"?`)) return;
      setLastChangedRow(row);
      setTableLoading(true);
      setTableError(null);
      try {
        const url = new URL("/api/ipa/picture-words", window.location.origin);
        url.searchParams.set("id", String(row.id));
        const response = await fetch(url.toString(), { method: "DELETE" });
        if (!response.ok) throw new Error(`Delete failed (${response.status})`);
        await fetchRows();
      } catch (e) {
        setTableError(e instanceof Error ? e.message : String(e));
      } finally {
        setTableLoading(false);
      }
    },
    [fetchRows]
  );

  const onVerify = useCallback(
    async (id: number) => {
      const previous = rows.find((row) => row.id === id);
      if (!previous) return;
      const draft =
        drafts[id] ?? {
          fa: previous.fa,
          ipa_fa: previous.ipa_fa,
          phinglish: previous.phinglish,
          usage: previous.usage,
          canBePersonal: previous.canBePersonal,
          canImagineAsHuman: previous.canImagineAsHuman,
          canUseAsHumanAdj: previous.canUseAsHumanAdj,
        };
      setSavingId(id);
      setTableError(null);
      setTableNotice("Saving…");

      const optimistic: PictureWordRow = {
        ...previous,
        fa: draft.fa,
        ipa_fa: draft.ipa_fa,
        phinglish: draft.phinglish,
        usage: draft.usage,
        canBePersonal: draft.canBePersonal,
        canImagineAsHuman: draft.canImagineAsHuman,
        canUseAsHumanAdj: draft.canUseAsHumanAdj,
        ipaVerified: true,
      };
      setLastChangedRow(optimistic);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                fa: draft.fa,
                ipa_fa: draft.ipa_fa,
                phinglish: draft.phinglish,
                usage: draft.usage,
                canBePersonal: draft.canBePersonal,
                canImagineAsHuman: draft.canImagineAsHuman,
                canUseAsHumanAdj: draft.canUseAsHumanAdj,
                ipaVerified: true,
              }
            : row
        )
      );
      try {
        const response = await fetch("/api/ipa/picture-words", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id,
            fa: draft.fa,
            ipa_fa: draft.ipa_fa,
            phinglish: draft.phinglish,
            usage: draft.usage,
            canBePersonal: draft.canBePersonal,
            canImagineAsHuman: draft.canImagineAsHuman,
            canUseAsHumanAdj: draft.canUseAsHumanAdj,
          }),
        });
        const data = (await response.json()) as {
          row?: PictureWordRow;
          ok?: boolean;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || `Update failed (${response.status})`);
        if (data.row) setLastChangedRow(data.row);
        setTableNotice("Saved and verified.");
      } catch (e) {
        setRows((prev) => prev.map((row) => (row.id === id ? previous : row)));
        setLastChangedRow(previous);
        setTableError(e instanceof Error ? e.message : String(e));
        setTableNotice(null);
      } finally {
        setSavingId(null);
      }
    },
    [drafts, rows]
  );

  const onAddLastChanged = useCallback(async () => {
    if (!lastChangedRow) return;
    setTableError(null);
    setTableNotice("Adding…");
    try {
      const response = await fetch("/api/ipa/picture-words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fa: lastChangedRow.fa,
          ipa_fa: lastChangedRow.ipa_fa,
          phinglish: lastChangedRow.phinglish,
          en: lastChangedRow.en,
          type: lastChangedRow.type,
          usage: lastChangedRow.usage,
          canBePersonal: lastChangedRow.canBePersonal,
          canImagineAsHuman: lastChangedRow.canImagineAsHuman,
          canUseAsHumanAdj: lastChangedRow.canUseAsHumanAdj,
          ipaVerified: lastChangedRow.ipaVerified,
        }),
      });

      const data = (await response.json()) as {
        row?: PictureWordRow;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || `Add failed (${response.status})`);
      if (!data.row) throw new Error("Unexpected response from server.");

      setRows((prev) => [...prev, data.row!]);
      setDrafts((prev) => ({
        ...prev,
        [data.row!.id]: {
          fa: data.row!.fa,
          ipa_fa: data.row!.ipa_fa,
          phinglish: data.row!.phinglish,
          usage: data.row!.usage,
          canBePersonal: data.row!.canBePersonal,
          canImagineAsHuman: data.row!.canImagineAsHuman,
          canUseAsHumanAdj: data.row!.canUseAsHumanAdj,
        },
      }));
      setLastChangedRow(data.row!);
      setTableNotice("Added.");
    } catch (e) {
      setTableError(e instanceof Error ? e.message : String(e));
      setTableNotice(null);
    }
  }, [lastChangedRow]);

  const getDraft = useCallback(
    (row: PictureWordRow) =>
      drafts[row.id] ?? {
        fa: row.fa,
        ipa_fa: row.ipa_fa,
        phinglish: row.phinglish,
        usage: row.usage,
        canBePersonal: row.canBePersonal,
        canImagineAsHuman: row.canImagineAsHuman,
        canUseAsHumanAdj: row.canUseAsHumanAdj,
      },
    [drafts]
  );

  const hasRowChanges = useCallback(
    (row: PictureWordRow) => {
      const draft = getDraft(row);
      return (
        draft.fa !== row.fa ||
        draft.ipa_fa !== row.ipa_fa ||
        draft.phinglish !== row.phinglish ||
        draft.usage !== row.usage ||
        draft.canBePersonal !== row.canBePersonal ||
        draft.canImagineAsHuman !== row.canImagineAsHuman ||
        draft.canUseAsHumanAdj !== row.canUseAsHumanAdj
      );
    },
    [getDraft]
  );

  const duplicateFaSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = row.fa.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dupes.add(key);
    }
    return dupes;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = rows;
    if (showUnverifiedOnly) base = base.filter((row) => !row.ipaVerified);
    if (showNotSetUsageOnly) base = base.filter((row) => row.usage === "notSet");
    if (showDuplicateFaOnly)
      base = base.filter((row) => duplicateFaSet.has(row.fa.trim()));
    if (!q) return base;
    return base.filter((row) => {
      if (searchIpaOnly) {
        return row.ipa_fa.toLowerCase().includes(q);
      }
      return (
        row.fa.toLowerCase().includes(q) ||
        row.en.toLowerCase().includes(q) ||
        row.phinglish.toLowerCase().includes(q) ||
        row.ipa_fa.toLowerCase().includes(q)
      );
    });
  }, [
    query,
    rows,
    showUnverifiedOnly,
    showNotSetUsageOnly,
    searchIpaOnly,
    showDuplicateFaOnly,
    duplicateFaSet,
  ]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    const items = [...filtered];

    items.sort((a, b) => {
      const aVal = sort.key === "fa" ? a.fa : a.type;
      const bVal = sort.key === "fa" ? b.fa : b.type;
      return dir * aVal.localeCompare(bVal, "fa");
    });

    return items;
  }, [filtered, sort]);

  const toggleSort = useCallback((key: "fa" | "type") => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }, []);

  const insertSpecialChar = useCallback(
    (character: string) => {
      const element = lastFocusedInputRef.current;
      if (!element) return;

      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? element.value.length;
      const nextValue =
        element.value.slice(0, start) + character + element.value.slice(end);
      const nextCursor = start + character.length;

      if (activeField?.kind === "draft") {
        if (activeField.field === "fa") return;
        setDrafts((prev) => ({
          ...prev,
          [activeField.id]: {
            fa: prev[activeField.id]?.fa ?? "",
            ipa_fa:
              activeField.field === "ipa_fa"
                ? nextValue
                : prev[activeField.id]?.ipa_fa ?? "",
            phinglish:
              activeField.field === "phinglish"
                ? nextValue
                : prev[activeField.id]?.phinglish ?? "",
            canBePersonal: prev[activeField.id]?.canBePersonal ?? false,
            canImagineAsHuman: prev[activeField.id]?.canImagineAsHuman ?? false,
            canUseAsHumanAdj: prev[activeField.id]?.canUseAsHumanAdj ?? false,
            usage: prev[activeField.id]?.usage ?? "notSet",
          },
        }));
      } else if (activeField?.kind === "search") {
        setQuery(nextValue);
      } else if (activeField?.kind === "import") {
        setImportText(nextValue);
      } else {
        return;
      }

      requestAnimationFrame(() => {
        try {
          element.focus();
          element.setSelectionRange(nextCursor, nextCursor);
        } catch {
          // ignore
        }
      });
    },
    [activeField]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[28rem_1fr] lg:items-start">
      <ImportSidebar
        text={importText}
        setText={setImportText}
        parsed={parsed}
        loading={importLoading}
        notice={importNotice}
        onImport={onImport}
        onTextFocus={(element) => {
          lastFocusedInputRef.current = element;
          setActiveField({ kind: "import" });
        }}
      />

      <main className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Picture Words
            </h1>
            <p className="text-sm text-muted">
              Stored in <code className="font-mono">PictureWord</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={(e) => {
                lastFocusedInputRef.current = e.currentTarget;
                setActiveField({ kind: "search" });
              }}
              placeholder="Search…"
              className="w-[min(24rem,92vw)] rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground"
            />
            <label className="inline-flex select-none items-center gap-2 rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={showUnverifiedOnly}
                onChange={(e) => setShowUnverifiedOnly(e.target.checked)}
              />
              Unverified only
            </label>
            <label className="inline-flex select-none items-center gap-2 rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={showNotSetUsageOnly}
                onChange={(e) => setShowNotSetUsageOnly(e.target.checked)}
              />
              usage = notSet
            </label>
            <label className="inline-flex select-none items-center gap-2 rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={searchIpaOnly}
                onChange={(e) => setSearchIpaOnly(e.target.checked)}
              />
              IPA only
            </label>
            <button
              type="button"
              onClick={() => setShowDuplicateFaOnly((v) => !v)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                showDuplicateFaOnly
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
                  : "border-card bg-background text-foreground hover:bg-card"
              }`}
            >
              Duplicate fa
            </button>
          </div>
        </div>

        <div className="text-sm text-muted">
          Showing {filtered.length} of {rows.length}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-card bg-card p-3 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">
            Special characters
          </div>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("æ");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            æ
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("x");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            x
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("ɪ");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            ɪ
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("ɜ");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            ɜ
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("ə");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            ə
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("ʊ");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            ʊ
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("ʔ");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            ʔ
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              insertSpecialChar("j");
            }}
            className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            j
          </button>
          <div className="ml-auto text-xs text-muted">
            Click a field, then click a character.
          </div>
        </div>

        {tableError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
            {tableError}
          </div>
        ) : null}

        <div className="rounded-2xl border border-card bg-card p-4 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">
            Last changed
          </div>
          {lastChangedRow ? (
            <div className="mt-3 overflow-auto rounded-xl border border-card bg-background">
              <table className="w-full table-fixed border-collapse">
                <tbody>
                  <tr className="border-t border-card text-[1.05rem]">
                    <td className="break-words px-4 py-3 text-foreground">
                      <input
                        value={drafts[lastChangedRow.id]?.fa ?? lastChangedRow.fa}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lastChangedRow.id]: {
                              fa: e.target.value,
                              ipa_fa:
                                prev[lastChangedRow.id]?.ipa_fa ??
                                lastChangedRow.ipa_fa,
                              phinglish:
                                prev[lastChangedRow.id]?.phinglish ??
                                lastChangedRow.phinglish,
                              usage:
                                prev[lastChangedRow.id]?.usage ??
                                lastChangedRow.usage,
                              canBePersonal:
                                prev[lastChangedRow.id]?.canBePersonal ??
                                lastChangedRow.canBePersonal,
                              canImagineAsHuman:
                                prev[lastChangedRow.id]?.canImagineAsHuman ??
                                lastChangedRow.canImagineAsHuman,
                              canUseAsHumanAdj:
                                prev[lastChangedRow.id]?.canUseAsHumanAdj ??
                                lastChangedRow.canUseAsHumanAdj,
                            },
                          }))
                        }
                        onFocus={(e) => {
                          lastFocusedInputRef.current = e.currentTarget;
                          setActiveField({
                            kind: "draft",
                            id: lastChangedRow.id,
                            field: "fa",
                          });
                        }}
                        disabled={
                          !rows.some((row) => row.id === lastChangedRow.id)
                        }
                        className="w-full rounded-lg border border-card bg-background px-2 py-1 text-[1.25rem] text-foreground disabled:opacity-60"
                      />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <input
                        value={
                          drafts[lastChangedRow.id]?.ipa_fa ??
                          lastChangedRow.ipa_fa
                        }
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lastChangedRow.id]: {
                              fa:
                                prev[lastChangedRow.id]?.fa ??
                                lastChangedRow.fa,
                              ipa_fa: e.target.value,
                              phinglish:
                                prev[lastChangedRow.id]?.phinglish ??
                                lastChangedRow.phinglish,
                              usage:
                                prev[lastChangedRow.id]?.usage ??
                                lastChangedRow.usage,
                              canBePersonal:
                                prev[lastChangedRow.id]?.canBePersonal ??
                                lastChangedRow.canBePersonal,
                              canImagineAsHuman:
                                prev[lastChangedRow.id]?.canImagineAsHuman ??
                                lastChangedRow.canImagineAsHuman,
                              canUseAsHumanAdj:
                                prev[lastChangedRow.id]?.canUseAsHumanAdj ??
                                lastChangedRow.canUseAsHumanAdj,
                            },
                          }))
                        }
                        onFocus={(e) => {
                          lastFocusedInputRef.current = e.currentTarget;
                          setActiveField({
                            kind: "draft",
                            id: lastChangedRow.id,
                            field: "ipa_fa",
                          });
                        }}
                        disabled={
                          !rows.some((row) => row.id === lastChangedRow.id)
                        }
                        className="w-full rounded-lg border border-card bg-background px-2 py-1 font-mono text-[1.25rem] text-foreground disabled:opacity-60"
                      />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <input
                        value={
                          drafts[lastChangedRow.id]?.phinglish ??
                          lastChangedRow.phinglish
                        }
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [lastChangedRow.id]: {
                              fa:
                                prev[lastChangedRow.id]?.fa ??
                                lastChangedRow.fa,
                              ipa_fa:
                                prev[lastChangedRow.id]?.ipa_fa ??
                                lastChangedRow.ipa_fa,
                              phinglish: e.target.value,
                              usage:
                                prev[lastChangedRow.id]?.usage ??
                                lastChangedRow.usage,
                              canBePersonal:
                                prev[lastChangedRow.id]?.canBePersonal ??
                                lastChangedRow.canBePersonal,
                              canImagineAsHuman:
                                prev[lastChangedRow.id]?.canImagineAsHuman ??
                                lastChangedRow.canImagineAsHuman,
                              canUseAsHumanAdj:
                                prev[lastChangedRow.id]?.canUseAsHumanAdj ??
                                lastChangedRow.canUseAsHumanAdj,
                            },
                          }))
                        }
                        onFocus={(e) => {
                          lastFocusedInputRef.current = e.currentTarget;
                          setActiveField({
                            kind: "draft",
                            id: lastChangedRow.id,
                            field: "phinglish",
                          });
                        }}
                        disabled={
                          !rows.some((row) => row.id === lastChangedRow.id)
                        }
                        className="w-full rounded-lg border border-card bg-background px-2 py-1 text-[1.25rem] text-foreground disabled:opacity-60"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {rows.some((row) => row.id === lastChangedRow.id) ? (
                        <button
                          type="button"
                          onClick={() => onVerify(lastChangedRow.id)}
                          disabled={
                            tableLoading ||
                            savingId === lastChangedRow.id ||
                            (lastChangedRow.ipaVerified &&
                              !hasRowChanges(lastChangedRow))
                          }
                          className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                          {savingId === lastChangedRow.id
                            ? "Saving…"
                            : lastChangedRow.ipaVerified
                            ? "Update"
                            : "Verify"}
                        </button>
                      ) : null}
                    </td>
                    <td className="break-words px-4 py-3 text-foreground">
                      {lastChangedRow.en}
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid gap-1">
                        {USAGE_VALUES.map((value) => (
                          <label
                            key={value}
                            className="inline-flex items-center gap-2 text-sm text-muted"
                          >
                            <input
                              type="radio"
                              name={`usage-${lastChangedRow.id}`}
                              value={value}
                              checked={
                                (drafts[lastChangedRow.id]?.usage ??
                                  lastChangedRow.usage) === value
                              }
                              onChange={() => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [lastChangedRow.id]: {
                                    fa:
                                      prev[lastChangedRow.id]?.fa ??
                                      lastChangedRow.fa,
                                    ipa_fa:
                                      prev[lastChangedRow.id]?.ipa_fa ??
                                      lastChangedRow.ipa_fa,
                                    phinglish:
                                      prev[lastChangedRow.id]?.phinglish ??
                                      lastChangedRow.phinglish,
                                    usage: value,
                                    canBePersonal:
                                      prev[lastChangedRow.id]?.canBePersonal ??
                                      lastChangedRow.canBePersonal,
                                    canImagineAsHuman:
                                      prev[lastChangedRow.id]
                                        ?.canImagineAsHuman ??
                                      lastChangedRow.canImagineAsHuman,
                                    canUseAsHumanAdj:
                                      prev[lastChangedRow.id]
                                        ?.canUseAsHumanAdj ??
                                      lastChangedRow.canUseAsHumanAdj,
                                  },
                                }));
                              }}
                              disabled={
                                !rows.some((row) => row.id === lastChangedRow.id)
                              }
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {rows.some((row) => row.id === lastChangedRow.id) ? (
                        <button
                          type="button"
                          onClick={() => onDelete(lastChangedRow)}
                          disabled={
                            tableLoading || savingId === lastChangedRow.id
                          }
                          aria-label="Delete"
                          className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-700 transition hover:bg-red-500/15 disabled:opacity-60"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onAddLastChanged}
                          disabled={tableLoading}
                          className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-500/15 disabled:opacity-60"
                        >
                          Add
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted">No changes yet.</div>
          )}
        </div>
        {tableNotice ? (
          <div className="pointer-events-none fixed bottom-6 right-6 z-50 max-w-[min(90vw,26rem)]">
            <div className="rounded-2xl border border-card bg-card/95 p-4 text-sm text-foreground shadow-elevated backdrop-blur">
              {tableNotice}
            </div>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="w-[16%] px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("fa")}
                      className={`inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition hover:bg-card hover:text-foreground ${
                        sort?.key === "fa"
                          ? "bg-card text-foreground shadow-elevated"
                          : ""
                      }`}
                      aria-sort={
                        sort?.key === "fa"
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <span>fa</span>
                      <span className="text-base font-bold">
                        {sort?.key === "fa"
                          ? sort.dir === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                  <th className="hidden px-4 py-3 lg:table-cell">ipa</th>
                  <th className="hidden px-4 py-3 lg:table-cell">phinglish</th>
                  {showUnverifiedOnly ? (
                    <th className="w-28 px-4 py-3">Verify</th>
                  ) : null}
                  <th className="w-[14%] px-4 py-3">en</th>
                  <th className="w-28 px-4 py-3">usage</th>
                  {!showUnverifiedOnly ? (
                    <th className="w-28 px-4 py-3">Verify</th>
                  ) : null}
                  <th className="w-14 px-2 py-3 text-center">
                    <TrashIcon className="mx-auto h-5 w-5 text-muted" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-card text-[1.05rem]"
                  >
                    <td className="break-words px-4 py-3 text-foreground">
                      <input
                        value={drafts[row.id]?.fa ?? row.fa}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              fa: e.target.value,
                              ipa_fa: prev[row.id]?.ipa_fa ?? row.ipa_fa,
                              phinglish:
                                prev[row.id]?.phinglish ?? row.phinglish,
                              canBePersonal:
                                prev[row.id]?.canBePersonal ??
                                row.canBePersonal,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-card bg-background px-2 py-1 text-[1.25rem] text-foreground"
                      />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <input
                        value={drafts[row.id]?.ipa_fa ?? row.ipa_fa}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              fa: prev[row.id]?.fa ?? row.fa,
                              ipa_fa: e.target.value,
                              phinglish:
                                prev[row.id]?.phinglish ?? row.phinglish,
                              canBePersonal:
                                prev[row.id]?.canBePersonal ??
                                row.canBePersonal,
                            },
                          }))
                        }
                        onFocus={(e) => {
                          lastFocusedInputRef.current = e.currentTarget;
                          setActiveField({
                            kind: "draft",
                            id: row.id,
                            field: "ipa_fa",
                          });
                        }}
                        className="w-full rounded-lg border border-card bg-background px-2 py-1 font-mono text-[1.25rem] text-foreground"
                      />
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <input
                        value={drafts[row.id]?.phinglish ?? row.phinglish}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.id]: {
                              fa: prev[row.id]?.fa ?? row.fa,
                              ipa_fa: prev[row.id]?.ipa_fa ?? row.ipa_fa,
                              phinglish: e.target.value,
                              canBePersonal:
                                prev[row.id]?.canBePersonal ??
                                row.canBePersonal,
                              canImagineAsHuman:
                                prev[row.id]?.canImagineAsHuman ??
                                row.canImagineAsHuman,
                              canUseAsHumanAdj:
                                prev[row.id]?.canUseAsHumanAdj ??
                                row.canUseAsHumanAdj,
                            },
                          }))
                        }
                        onFocus={(e) => {
                          lastFocusedInputRef.current = e.currentTarget;
                          setActiveField({
                            kind: "draft",
                            id: row.id,
                            field: "phinglish",
                          });
                        }}
                        className="w-full rounded-lg border border-card bg-background px-2 py-1 text-[1.25rem] text-foreground"
                      />
                    </td>
                    {showUnverifiedOnly ? (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onVerify(row.id)}
                          disabled={
                            tableLoading ||
                            savingId === row.id ||
                            (row.ipaVerified && !hasRowChanges(row))
                          }
                          className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                          {savingId === row.id
                            ? "Saving…"
                            : row.ipaVerified
                            ? "Update"
                            : "Verify"}
                        </button>
                      </td>
                    ) : null}
                    <td className="break-words px-4 py-3 text-foreground">
                      {row.en}
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid gap-1">
                        {USAGE_VALUES.map((value) => (
                          <label
                            key={value}
                            className="inline-flex items-center gap-2 text-sm text-muted"
                          >
                            <input
                              type="radio"
                              name={`usage-${row.id}`}
                              value={value}
                              checked={(drafts[row.id]?.usage ?? row.usage) === value}
                              onChange={() => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    fa: prev[row.id]?.fa ?? row.fa,
                                    ipa_fa: prev[row.id]?.ipa_fa ?? row.ipa_fa,
                                    phinglish:
                                      prev[row.id]?.phinglish ?? row.phinglish,
                                    usage: value,
                                    canBePersonal:
                                      prev[row.id]?.canBePersonal ??
                                      row.canBePersonal,
                                    canImagineAsHuman:
                                      prev[row.id]?.canImagineAsHuman ??
                                      row.canImagineAsHuman,
                                    canUseAsHumanAdj:
                                      prev[row.id]?.canUseAsHumanAdj ??
                                      row.canUseAsHumanAdj,
                                  },
                                }));
                              }}
                            />
                            <span>{value}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    {!showUnverifiedOnly ? (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onVerify(row.id)}
                          disabled={
                            tableLoading ||
                            savingId === row.id ||
                            (row.ipaVerified && !hasRowChanges(row))
                          }
                          className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                          {savingId === row.id
                            ? "Saving…"
                            : row.ipaVerified
                            ? "Update"
                            : "Verify"}
                        </button>
                      </td>
                    ) : null}
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        disabled={tableLoading || savingId === row.id}
                        aria-label="Delete"
                        className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-700 transition hover:bg-red-500/15 disabled:opacity-60"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {sorted.length === 0 ? (
                  <tr className="border-t border-card">
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted"
                    >
                      No results.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
