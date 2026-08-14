"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/icons/ActionIcon";

type FieldPolicy = {
  key: string;
  label: string;
  kind: "action" | "managed" | "protected";
  description: string;
  consequences: string[];
  managedBy: string | null;
  managedByLabel: string | null;
};

type Operation = {
  id: string;
  field: string;
  label: string;
  affectedRows: number;
  status: string;
  createdAt: string;
  undoneAt: string | null;
  canUndo: boolean;
  report?: SentenceMaintenanceReport | null;
};

type ScopeKind = "explicit_ids" | "id_range" | "selected_rows" | "filtered_results" | "all_rows";
type ScopeContext = {
  filter: { q: string; review: "all" | "pending" | "reviewed"; missingConceptAudio: boolean };
  filteredCount: number;
};

type SentenceMaintenanceReport = {
  kind: "sentence_links";
  requestId: string;
  previewId: string;
  linkCount: number;
  affectedWordSenseIds: number[];
  sharedSentenceIds: number[];
  orphanedSentenceIds: number[];
  protectedSentenceIds: number[];
  missingSentenceIds: number[];
  deletedSentences: Array<{ id: number }>;
};

type ActionPreview = {
  mode: "action";
  field: string;
  label: string;
  description: string;
  consequences: string[];
  affectedRows: number;
  aiMeaningReviewsReset: number;
  conceptMergeReviewsReset: number;
  fileCount: number;
  bytes: number;
  confirmationText: string;
  operationKind?: "sentence_links";
  previewId?: string;
  expiresAt?: string;
  scopedRows?: number;
  linkCount?: number;
  affectedWordSenseIds?: number[];
  linkedSentenceIds?: number[];
  sharedSentenceIds?: number[];
  orphanedSentenceIds?: number[];
  missingSentenceIds?: number[];
  deleteOrphanedSentences?: boolean;
};

type GuidePreview = {
  mode: "guide";
  field: string;
  label: string;
  kind: "managed" | "protected";
  description: string;
  consequences: string[];
  managedBy: string | null;
  managedByLabel: string | null;
};

type Preview = ActionPreview | GuidePreview;

const textButtonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TableFieldMaintenance({
  modelLabel,
  apiBase,
  scopeContext,
}: {
  modelLabel: string;
  apiBase: string;
  scopeContext?: ScopeContext;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldPolicy[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [field, setField] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [scopeKind, setScopeKind] = useState<ScopeKind>("explicit_ids");
  const [explicitIds, setExplicitIds] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [deleteOrphanedSentences, setDeleteOrphanedSentences] = useState(false);
  const [lastReport, setLastReport] = useState<Record<string, unknown> | null>(null);
  const [executionRequestId, setExecutionRequestId] = useState("");

  async function loadConfiguration() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(apiBase, { cache: "no-store" });
      const result = (await response.json()) as {
        ok?: boolean;
        fields?: FieldPolicy[];
        operations?: Operation[];
        error?: string;
      };
      if (!response.ok || !result.ok || !result.fields || !result.operations) {
        throw new Error(result.error || "Could not load field-maintenance options.");
      }
      setFields(result.fields);
      setOperations(result.operations);
      setField((current) => current || result.fields?.find((item) => item.kind === "action")?.key || result.fields?.[0]?.key || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }

  function show() {
    setOpen(true);
    setNotice(null);
    setPreview(null);
    setConfirmation("");
    setLastReport(null);
    setExecutionRequestId("");
    void loadConfiguration();
  }

  function close() {
    if (!executing && !undoing) setOpen(false);
  }

  function selectedRowIds() {
    return Array.from(document.querySelectorAll<HTMLInputElement>("input[data-word-sense-maintenance-row]:checked"))
      .map((input) => Number(input.value))
      .filter((id) => Number.isSafeInteger(id) && id > 0);
  }

  function currentScope() {
    if (scopeKind === "explicit_ids") return { kind: scopeKind, input: explicitIds };
    if (scopeKind === "id_range") return { kind: scopeKind, startId: Number(rangeStart), endId: Number(rangeEnd) };
    if (scopeKind === "selected_rows") return { kind: scopeKind, ids: selectedRowIds() };
    if (scopeKind === "filtered_results") return { kind: scopeKind, filter: scopeContext?.filter };
    return { kind: "all_rows" as const };
  }

  function invalidatePreview() {
    setPreview(null);
    setConfirmation("");
    setError(null);
    setExecutionRequestId("");
  }

  async function createPreview(nextDeleteOrphaned = deleteOrphanedSentences) {
    if (!field) return;
    setPreviewing(true);
    setError(null);
    setNotice(null);
    setPreview(null);
    setConfirmation("");
    try {
      const response = await fetch(`${apiBase}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          ...(field === "sentenceIds" ? {
            scope: currentScope(),
            deleteOrphanedSentences: nextDeleteOrphaned,
          } : {}),
        }),
      });
      const result = (await response.json()) as { ok?: boolean; preview?: Preview; error?: string };
      if (!response.ok || !result.ok || !result.preview) {
        throw new Error(result.error || "Could not prepare the field-maintenance preview.");
      }
      setPreview(result.preview);
      setExecutionRequestId(crypto.randomUUID());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setPreviewing(false);
    }
  }

  async function execute() {
    if (!preview || preview.mode !== "action" || confirmation !== preview.confirmationText) return;
    setExecuting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field: preview.field,
          expectedAffectedRows: preview.affectedRows,
          confirmation,
          ...(preview.operationKind === "sentence_links" ? {
            previewId: preview.previewId,
            requestId: executionRequestId,
          } : {}),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        result?: {
          affectedRows: number;
          quarantinedFiles?: number;
          unlinkedSentenceLinks?: number;
          deletedSentences?: number;
          protectedSentences?: number;
          report?: SentenceMaintenanceReport;
        };
        error?: string;
      };
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.error || "Could not clear the selected field.");
      }
      setNotice(preview.operationKind === "sentence_links"
        ? `Unlinked ${(result.result.unlinkedSentenceLinks ?? 0).toLocaleString()} sentence link(s) from ${result.result.affectedRows.toLocaleString()} WordSense row(s). ` +
          `Deleted ${(result.result.deletedSentences ?? 0).toLocaleString()} newly unreferenced Sentence row(s); ${(result.result.protectedSentences ?? 0).toLocaleString()} were protected after recheck.`
        : `Cleared ${result.result.affectedRows.toLocaleString()} ${modelLabel} rows. ` +
          `${(result.result.quarantinedFiles ?? 0).toLocaleString()} audio file(s) were quarantined.`);
      if (result.result.report) setLastReport(result.result.report as unknown as Record<string, unknown>);
      setPreview(null);
      setConfirmation("");
      await loadConfiguration();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExecuting(false);
    }
  }

  const actionFields = fields.filter((item) => item.kind === "action");
  const managedFields = fields.filter((item) => item.kind === "managed");
  const protectedFields = fields.filter((item) => item.kind === "protected");
  const selectedField = fields.find((item) => item.key === field);
  const isSentenceLinks = modelLabel === "WordSense" && field === "sentenceIds";

  function downloadJson(name: string, value: unknown) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function undo(operationId: string) {
    setUndoing(operationId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationId }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        result?: { restoredRows: number; restoredFiles: number; restoredSentences?: number };
        error?: string;
      };
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.error || "Could not undo this maintenance operation.");
      }
      setNotice(
        `Restored ${result.result.restoredRows.toLocaleString()} ${modelLabel} rows and ` +
        `${result.result.restoredFiles.toLocaleString()} audio file(s)` +
        `${result.result.restoredSentences ? ` and ${result.result.restoredSentences.toLocaleString()} Sentence row(s)` : ""}.`,
      );
      await loadConfiguration();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setUndoing(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={`${textButtonClass} border-red-500/60 text-red-700 dark:text-red-300`}
      >
        Clear field data…
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] overflow-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-field-maintenance-title"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <div className="mx-auto my-[4vh] w-full max-w-3xl rounded-2xl border border-card bg-background p-5 shadow-elevated">
            <div>
              <h2 id="table-field-maintenance-title" className="text-lg font-semibold">
                {modelLabel} field maintenance
              </h2>
              <p className="mt-1 text-sm opacity-75">
                Clear populated values across the {modelLabel} table with explicit dependency handling and a reversible snapshot.
              </p>
            </div>

            {loading && !fields.length ? (
              <div className="mt-4 rounded border p-4 text-sm">Loading maintenance policies…</div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-4 rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-800 dark:text-green-200">
                {notice}
                {lastReport ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={`/words/tables/sentences?maintenanceOperationId=${encodeURIComponent(String(lastReport.requestId))}`} className="underline">Inspect affected Sentences</a>
                    <button type="button" onClick={() => downloadJson("word-sense-maintenance-result.json", lastReport)} className="underline">Export result JSON</button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <section className="mt-4 rounded border p-3">
              <div className="grid gap-3">
                <div className="grid gap-1 text-sm">
                  <span className="inline-flex items-center gap-2">
                    {modelLabel} field or managed bundle
                    <button
                      type="button"
                      onClick={() => setShowHelp((current) => !current)}
                      aria-label="About field maintenance policies"
                      aria-expanded={showHelp}
                      title="Explain field bundles, dependencies, and recovery"
                      className="inline-flex size-6 items-center justify-center rounded-full border transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <ActionIcon name="help" className="size-4" />
                    </button>
                  </span>
                  <select
                    aria-label={`${modelLabel} field or managed bundle`}
                    value={field}
                    disabled={loading || executing || Boolean(undoing)}
                    onChange={(event) => {
                      setField(event.target.value);
                      invalidatePreview();
                    }}
                    className="rounded border bg-background px-3 py-2"
                  >
                    <optgroup label="Direct maintenance policies">
                      {actionFields.map((item) => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Managed through another policy">
                      {managedFields.map((item) => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Protected fields">
                      {protectedFields.map((item) => (
                        <option key={item.key} value={item.key}>{item.label}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {isSentenceLinks ? (
                  <fieldset className="grid gap-3 rounded border bg-black/[0.015] p-3 dark:bg-white/[0.025]">
                    <legend className="px-1 text-sm font-semibold">Scope</legend>
                    <label className="grid gap-1 text-sm">
                      Scope type
                      <select
                        value={scopeKind}
                        disabled={previewing || executing || Boolean(undoing)}
                        onChange={(event) => {
                          setScopeKind(event.target.value as ScopeKind);
                          invalidatePreview();
                        }}
                        className="rounded border bg-background px-3 py-2"
                      >
                        <option value="explicit_ids">Explicit WordSense ids</option>
                        <option value="id_range">WordSense id range</option>
                        <option value="selected_rows">Selected rows</option>
                        <option value="filtered_results">Current filtered results</option>
                        <option value="all_rows">Entire table</option>
                      </select>
                    </label>
                    {scopeKind === "explicit_ids" ? (
                      <label className="grid gap-1 text-sm">
                        WordSense ids
                        <textarea
                          value={explicitIds}
                          onChange={(event) => { setExplicitIds(event.target.value); invalidatePreview(); }}
                          placeholder={'[12, 34, 56] or 12, 34\n56'}
                          rows={3}
                          className="rounded border bg-background px-3 py-2 font-mono"
                        />
                        <span className="text-xs opacity-70">JSON arrays and comma-, whitespace-, or newline-separated ids are accepted. Duplicates are removed.</span>
                      </label>
                    ) : null}
                    {scopeKind === "id_range" ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm">Start id<input inputMode="numeric" value={rangeStart} onChange={(event) => { setRangeStart(event.target.value); invalidatePreview(); }} className="rounded border bg-background px-3 py-2 font-mono" /></label>
                        <label className="grid gap-1 text-sm">End id<input inputMode="numeric" value={rangeEnd} onChange={(event) => { setRangeEnd(event.target.value); invalidatePreview(); }} className="rounded border bg-background px-3 py-2 font-mono" /></label>
                      </div>
                    ) : null}
                    {scopeKind === "selected_rows" ? (
                      <p className="text-sm opacity-75">Uses the checked rows currently visible in the WordSense table. Missing or stale selections block execution.</p>
                    ) : null}
                    {scopeKind === "filtered_results" ? (
                      <div className="rounded border bg-background p-2 text-sm">
                        Current filters resolve on the server: <strong>{scopeContext?.filteredCount.toLocaleString() ?? "—"}</strong> matching row(s).
                      </div>
                    ) : null}
                    {scopeKind === "all_rows" ? (
                      <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-800 dark:text-red-200">
                        Entire table is the highest-risk Scope. Confirmation explicitly says <strong>CLEAR ALL</strong>, and execution never expands beyond the rows captured by Preview.
                      </div>
                    ) : null}
                  </fieldset>
                ) : null}
                <button
                  type="button"
                  disabled={!field || previewing || executing || Boolean(undoing)}
                  onClick={() => void createPreview()}
                  className={`${textButtonClass} justify-self-end`}
                >
                  {previewing ? "Preparing…" : "Preview changes"}
                </button>
              </div>
              {showHelp ? (
                <div className="mt-3 space-y-3 rounded border border-blue-500/30 bg-blue-500/5 p-3 text-sm">
                  <div>
                    <div className="font-semibold">How field policies work</div>
                    <p className="mt-1 opacity-80">
                      Every {modelLabel} field appears in the selector. Direct policies can run after Preview; managed fields explain which safe bundle owns them; protected fields explain why the database requires them.
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold">Why owned-audio columns are bundled</div>
                    <p className="mt-1 opacity-80">
                      Each owned-audio unit includes its filename, source text, and physical file. Clearing only one column could break stale-audio detection or leave orphaned metadata, so Preview directs managed columns to their safe bundle.
                    </p>
                  </div>
                  <ul className="list-disc space-y-1 pl-5 opacity-80">
                    <li>Audio bundles clear both metadata columns and move physical files to quarantine.</li>
                    <li>Source fields also clear their documented derived fields when required.</li>
                    <li>Preview shows the exact row, review, and file counts before confirmation.</li>
                    <li>The latest recovery snapshot can restore database values and quarantined audio with Undo.</li>
                  </ul>
                  <div className="border-t pt-3">
                    <div className="font-semibold">Complete {modelLabel} field reference</div>
                    <div className="mt-2 space-y-2">
                      {fields.map((item) => (
                        <details key={item.key} open={item.kind === "managed" && item.key.includes("audio_source_text")} className="rounded border bg-background p-2">
                          <summary className="cursor-pointer font-mono text-xs font-semibold">
                            {item.label} <span className="font-sans font-normal opacity-60">— {item.kind}</span>
                          </summary>
                          <p className="mt-2 text-xs opacity-80">{item.description}</p>
                          {item.consequences.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-80">
                              {item.consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}
                            </ul>
                          ) : null}
                        </details>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
              {selectedField ? (
                <p className="mt-2 text-xs opacity-70">
                  <span className="mr-2 rounded-full border px-2 py-0.5 font-semibold">{selectedField.kind}</span>
                  {selectedField.description}
                </p>
              ) : null}
            </section>

            {preview ? (
              <section className={`mt-4 space-y-3 rounded border p-4 ${
                preview.mode === "action"
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-blue-500/40 bg-blue-500/5"
              }`}>
                {preview.mode === "guide" ? (
                  <>
                    <div>
                      <div className="font-semibold text-blue-800 dark:text-blue-200">
                        {preview.kind === "managed" ? "Managed-field guidance" : "Protected-field guidance"}
                      </div>
                      <div className="mt-1 text-sm">{preview.description}</div>
                    </div>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {preview.consequences.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                    {preview.managedBy ? (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setField(preview.managedBy!);
                            setPreview(null);
                            setConfirmation("");
                          }}
                          className={textButtonClass}
                        >
                          Select {preview.managedByLabel}
                        </button>
                      </div>
                    ) : (
                      <div className="rounded border bg-background p-2 text-sm opacity-75">
                        This field has no safe table-wide clear operation.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <div className="font-semibold text-red-700 dark:text-red-300">Destructive change preview</div>
                      <div className="mt-1 text-sm">{preview.description}</div>
                    </div>
                    {preview.operationKind === "sentence_links" ? (
                      <>
                        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded border bg-background p-2"><dt className="text-xs opacity-70">Scoped WordSense rows</dt><dd className="font-mono font-semibold">{preview.scopedRows?.toLocaleString()}</dd></div>
                          <div className="rounded border bg-background p-2"><dt className="text-xs opacity-70">WordSenses changed</dt><dd className="font-mono font-semibold">{preview.affectedRows.toLocaleString()}</dd></div>
                          <div className="rounded border bg-background p-2"><dt className="text-xs opacity-70">Sentence links removed</dt><dd className="font-mono font-semibold">{preview.linkCount?.toLocaleString()}</dd></div>
                          <div className="rounded border bg-background p-2"><dt className="text-xs opacity-70">Distinct Sentences</dt><dd className="font-mono font-semibold">{preview.linkedSentenceIds?.length.toLocaleString()}</dd></div>
                          <div className="rounded border bg-background p-2"><dt className="text-xs opacity-70">Shared and protected</dt><dd className="font-mono font-semibold">{preview.sharedSentenceIds?.length.toLocaleString()}</dd></div>
                          <div className="rounded border bg-background p-2"><dt className="text-xs opacity-70">Will become unreferenced</dt><dd className="font-mono font-semibold">{preview.orphanedSentenceIds?.length.toLocaleString()}</dd></div>
                        </dl>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-background p-3 text-sm">
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={deleteOrphanedSentences}
                              disabled={previewing || executing}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                setDeleteOrphanedSentences(checked);
                                setPreview(null);
                                setConfirmation("");
                                void createPreview(checked);
                              }}
                            />
                            <span>Delete Sentence rows that this operation leaves with no WordSense links (rechecked during execution and restorable by Undo).</span>
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {preview.linkedSentenceIds?.length ? (
                              <a href={`/words/tables/sentences?maintenancePreviewId=${encodeURIComponent(preview.previewId ?? "")}`} className="underline">Inspect affected Sentences</a>
                            ) : null}
                            <button type="button" onClick={() => downloadJson("word-sense-maintenance-preview.json", preview)} className="underline">Export preview JSON</button>
                          </div>
                        </div>
                        {preview.missingSentenceIds?.length ? (
                          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-900 dark:text-amber-100">
                            Referenced Sentence id(s) not found: {preview.missingSentenceIds.join(", ")}. Their broken links will be reported but no Sentence deletion is attempted.
                          </div>
                        ) : null}
                        <p className="text-xs opacity-70">Preview expires at {preview.expiresAt ? formatDate(preview.expiresAt) : "—"}. Any Scope or option change requires a new Preview.</p>
                      </>
                    ) : (
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div className="rounded border bg-background p-2">
                        <dt className="text-xs opacity-70">Populated {modelLabel} rows</dt>
                        <dd className="font-mono font-semibold">{preview.affectedRows.toLocaleString()}</dd>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <dt className="text-xs opacity-70">AI meaning reviews reset</dt>
                        <dd className="font-mono font-semibold">{preview.aiMeaningReviewsReset.toLocaleString()}</dd>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <dt className="text-xs opacity-70">Concept merge reviews reset</dt>
                        <dd className="font-mono font-semibold">{preview.conceptMergeReviewsReset.toLocaleString()}</dd>
                      </div>
                      <div className="rounded border bg-background p-2">
                        <dt className="text-xs opacity-70">Audio moved to quarantine</dt>
                        <dd className="font-mono font-semibold">
                          {preview.fileCount.toLocaleString()} file(s), {formatBytes(preview.bytes)}
                        </dd>
                      </div>
                    </dl>
                    )}
                    {preview.consequences.length ? (
                      <div>
                        <div className="text-sm font-semibold">Dependent changes</div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                          {preview.consequences.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}
                    {preview.affectedRows > 0 ? (
                      <label className="grid gap-1 text-sm">
                        Type <code className="select-all rounded bg-black/5 px-1 py-0.5">{preview.confirmationText}</code> to confirm
                        <input
                          value={confirmation}
                          onChange={(event) => setConfirmation(event.target.value)}
                          autoComplete="off"
                          className="rounded border bg-background px-3 py-2 font-mono"
                        />
                      </label>
                    ) : (
                      <div className="text-sm opacity-70">There are no populated values to clear.</div>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={
                          preview.affectedRows === 0 ||
                          confirmation !== preview.confirmationText ||
                          executing ||
                          Boolean(undoing)
                        }
                        onClick={() => void execute()}
                        className={`${textButtonClass} border-red-600 bg-red-600 text-white hover:bg-red-700`}
                      >
                        {executing
                          ? "Applying confirmed changes…"
                          : preview.operationKind === "sentence_links"
                            ? "Unlink sentences and save recovery snapshot"
                            : "Clear field and save recovery snapshot"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            <section className="mt-4 rounded border p-3">
              <div className="font-semibold">Recent recovery snapshots</div>
              <p className="mt-1 text-xs opacity-70">
                Undo is intentionally last-in-first-out so an older snapshot cannot overwrite a newer operation.
              </p>
              {operations.length ? (
                <div className="mt-3 space-y-2">
                  {operations.map((operation) => (
                    <div key={operation.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                      <div>
                        <div className="font-medium">{operation.label}</div>
                        <div className="text-xs opacity-70">
                          {operation.affectedRows.toLocaleString()} rows • {formatDate(operation.createdAt)} • {operation.status}
                        </div>
                        {operation.report ? (
                          <div className="mt-1 flex gap-3 text-xs">
                            <a href={`/words/tables/sentences?maintenanceOperationId=${encodeURIComponent(operation.id)}`} className="underline">Inspect Sentences</a>
                            <button type="button" onClick={() => downloadJson(`word-sense-maintenance-${operation.id}.json`, operation.report)} className="underline">Export report</button>
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={!operation.canUndo || executing || Boolean(undoing)}
                        onClick={() => void undo(operation.id)}
                        className={textButtonClass}
                        title={operation.canUndo ? "Restore this snapshot" : "Undo newer completed operations first"}
                      >
                        {undoing === operation.id ? "Restoring…" : "Undo"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm opacity-70">No field-maintenance snapshots yet.</div>
              )}
            </section>

            <div className="mt-5 flex justify-end">
              <button type="button" disabled={executing || Boolean(undoing)} onClick={close} className={textButtonClass}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
