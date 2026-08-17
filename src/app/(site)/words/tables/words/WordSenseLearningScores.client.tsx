"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ModalPortal } from "@/components/modal-portal";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { RemainingCountBadge } from "@/components/remaining-count";
import {
  CUSTOM_EXTRACTION_BASE_PROMPT_PATH,
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
  type CustomExtractionFieldKey,
} from "@/lib/word-extraction/customExtractionFields";

const REQUESTED_OUTPUTS_PROMPT_PATH = "custom-extraction/requested_outputs_v1.md";
const INPUT_RECORDS_PROMPT_PATH = "custom-extraction/input_records_v1.md";
const SCORE_FIELDS = ["imageability", "learning_depth", "productive_target"] as const;
const INPUT_FIELDS: CustomExtractionFieldKey[] = [
  "base_form",
  "meaning_fa",
  "other_meanings_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
  "pos",
  "concept_explained_fa",
  ...SCORE_FIELDS,
];

type ScoreField = (typeof SCORE_FIELDS)[number];
type ScoreCounts = Record<ScoreField, number>;
type PromptTexts = Record<string, string>;

const SCORE_LABELS: Record<ScoreField, { label: string; range: string }> = {
  imageability: { label: "Imageability", range: "Integer · 1–100" },
  learning_depth: { label: "Learning depth", range: "-100 or decimal · 0–1" },
  productive_target: { label: "Productive target", range: "Integer · 1–101" },
};

const secondaryButton =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50";

function selectedScoreFields(value: readonly ScoreField[]) {
  return SCORE_FIELDS.filter((field) => value.includes(field));
}

export default function WordSenseLearningScores({
  initialRemainingCount,
  initialFieldCounts,
}: {
  initialRemainingCount: number;
  initialFieldCounts: ScoreCounts;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<ScoreField[]>([...SCORE_FIELDS]);
  const [fieldCounts, setFieldCounts] = useState<ScoreCounts>(initialFieldCounts);
  const [remainingCount, setRemainingCount] = useState(initialRemainingCount);
  const [limit, setLimit] = useState(String(initialRemainingCount));
  const [promptTexts, setPromptTexts] = useState<PromptTexts>({});
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [promptError, setPromptError] = useState("");
  const [recordsJson, setRecordsJson] = useState("[]");
  const [recordsStats, setRecordsStats] = useState<{ total: number; fetched: number } | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const [copied, setCopied] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applyReport, setApplyReport] = useState("");
  const [applyDetails, setApplyDetails] = useState("");

  useEffect(() => setFieldCounts(initialFieldCounts), [initialFieldCounts]);
  useEffect(() => setRemainingCount(initialRemainingCount), [initialRemainingCount]);
  useEffect(() => setLimit(String(initialRemainingCount)), [initialRemainingCount]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const outputSpecs = useMemo(
    () => CUSTOM_EXTRACTION_OUTPUT_FIELDS.filter((field) => fields.includes(field.key as ScoreField)),
    [fields],
  );

  useEffect(() => {
    if (!open || !fields.length) return;
    let canceled = false;
    const paths = [
      CUSTOM_EXTRACTION_BASE_PROMPT_PATH,
      ...outputSpecs.map((field) => field.promptPath),
      REQUESTED_OUTPUTS_PROMPT_PATH,
      INPUT_RECORDS_PROMPT_PATH,
    ];
    setLoadingPrompts(true);
    setPromptError("");
    Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`/api/ai/prompt-file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
        const json = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
        if (!response.ok || typeof json?.text !== "string") {
          throw new Error(json?.error ?? `Could not load ${path}.`);
        }
        return [path, json.text] as const;
      }),
    )
      .then((entries) => {
        if (!canceled) setPromptTexts(Object.fromEntries(entries));
      })
      .catch((error) => {
        if (!canceled) setPromptError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!canceled) setLoadingPrompts(false);
      });
    return () => {
      canceled = true;
    };
  }, [fields, open, outputSpecs]);

  const promptOnly = useMemo(() => {
    const base = promptTexts[CUSTOM_EXTRACTION_BASE_PROMPT_PATH]?.trim() ?? "";
    const rules = outputSpecs
      .map((field) => promptTexts[field.promptPath]?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n---\n\n");
    const requestedOutputs = promptTexts[REQUESTED_OUTPUTS_PROMPT_PATH]?.trim() ?? "";
    return [base, rules, `${requestedOutputs}\n${JSON.stringify(fields, null, 2)}`]
      .filter(Boolean)
      .join("\n\n---\n\n");
  }, [fields, outputSpecs, promptTexts]);

  const completePrompt = `${promptOnly}\n\n---\n\n${promptTexts[INPUT_RECORDS_PROMPT_PATH]?.trim() ?? ""}\n${recordsJson}`;

  useEffect(() => {
    if (!open || !fields.length) {
      if (!fields.length) setRemainingCount(0);
      return;
    }
    let canceled = false;
    fetch(`/api/word-extraction/custom/field-counts?fields=${encodeURIComponent(fields.join(","))}`, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as { ok?: boolean; selectedTotal?: number } | null;
        if (!response.ok || !json?.ok || typeof json.selectedTotal !== "number") return;
        if (!canceled) setRemainingCount(json.selectedTotal);
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, [fields, open]);

  function resetPackage() {
    setRecordsJson("[]");
    setRecordsStats(null);
    setRecordsError("");
    setResponseText("");
    setApplyError("");
    setApplyReport("");
    setApplyDetails("");
    setApplied(false);
    setCopied(false);
  }

  function toggleField(field: ScoreField, checked: boolean) {
    setFields((current) => selectedScoreFields(
      checked ? [...current, field] : current.filter((item) => item !== field),
    ));
    resetPackage();
  }

  async function createInputData() {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 0) {
      setRecordsError("Count must be a non-negative integer.");
      return;
    }
    if (!fields.length) {
      setRecordsError("Select at least one score field.");
      return;
    }
    setLoadingRecords(true);
    resetPackage();
    try {
      const params = new URLSearchParams({
        inputs: INPUT_FIELDS.join(","),
        outputs: fields.join(","),
        limit: String(parsedLimit),
      });
      const response = await fetch(`/api/word-extraction/custom/records?${params}`, { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        fetched?: number;
        items?: unknown[];
      } | null;
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${response.status}).`);
      setRecordsJson(JSON.stringify(json.items ?? [], null, 2));
      setRecordsStats({ total: json.total ?? 0, fetched: json.fetched ?? 0 });
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingRecords(false);
    }
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(completePrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function pasteResponse() {
    setApplyError("");
    setApplied(false);
    try {
      setResponseText(await navigator.clipboard.readText());
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshFieldCounts() {
    const response = await fetch(`/api/word-extraction/custom/field-counts?fields=${encodeURIComponent(fields.join(","))}`, { cache: "no-store" });
    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      counts?: Partial<Record<ScoreField, number>>;
      selectedTotal?: number;
    } | null;
    if (!response.ok || !json?.ok) return;
    setFieldCounts({
      imageability: json.counts?.imageability ?? 0,
      learning_depth: json.counts?.learning_depth ?? 0,
      productive_target: json.counts?.productive_target ?? 0,
    });
    if (typeof json.selectedTotal === "number") setRemainingCount(json.selectedTotal);
  }

  async function applyResponse() {
    setApplying(true);
    setApplyError("");
    setApplyReport("");
    setApplyDetails("");
    try {
      const items = JSON.parse(responseText) as unknown;
      if (!Array.isArray(items)) throw new Error("AI response must be a JSON array.");
      const requests = JSON.parse(recordsJson) as unknown;
      if (!Array.isArray(requests) || !requests.length) {
        throw new Error("Create input data before applying the AI response.");
      }
      const response = await fetch("/api/word-extraction/custom/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputs: fields, requests, items }),
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        issues?: unknown;
        total?: number;
        updated?: number;
        failed?: number;
        results?: unknown;
      } | null;
      if (!response.ok || !json?.ok) {
        const details = json?.issues ? `\n${JSON.stringify(json.issues, null, 2)}` : "";
        throw new Error(`${json?.error ?? `Request failed (${response.status}).`}${details}`);
      }
      setApplyReport(`${json.updated ?? 0} of ${json.total ?? 0} records applied${json.failed ? ` · ${json.failed} failed` : ""}.`);
      setApplyDetails(JSON.stringify(json.results ?? [], null, 2));
      setApplied((json.failed ?? 0) === 0);
      await refreshFieldCounts();
      router.refresh();
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
      >
        <span>5. COMPLETE LEARNING SCORES</span>
        <RemainingCountBadge count={initialRemainingCount} />
      </button>

      {open ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-scores-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-card bg-background shadow-elevated">
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-card p-5">
                <div>
                  <h2 id="learning-scores-title" className="text-xl font-bold text-foreground">
                    Complete learning scores
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
                    Select the missing score fields. A record is included when at least one selected field is missing, and its requested_outputs lists only the values it still needs.
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>Close</button>
              </header>

              <div className="min-h-0 overflow-y-auto p-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
                  <aside className="grid content-start gap-4">
                    <section className="rounded-2xl border border-card bg-card p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-foreground">Fields to fill</h3>
                        <span className="text-xs text-muted">Selected remaining: {remainingCount.toLocaleString()}</span>
                      </div>
                      <div className="grid gap-2">
                        {SCORE_FIELDS.map((field) => (
                          <label
                            key={field}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                              fields.includes(field)
                                ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary),transparent_90%)]"
                                : "border-card bg-background"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={fields.includes(field)}
                              onChange={(event) => toggleField(field, event.target.checked)}
                              className="mt-1 h-4 w-4 accent-[var(--primary)]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground">{SCORE_LABELS[field].label}</span>
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                  Pending · {fieldCounts[field].toLocaleString()}
                                </span>
                              </span>
                              <span className="mt-1 block text-[11px] text-muted">{SCORE_LABELS[field].range}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-card bg-card p-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="grid gap-1 text-xs font-semibold text-muted">
                          Count
                          <input
                            type="number"
                            min="0"
                            value={limit}
                            onChange={(event) => {
                              setLimit(event.target.value);
                              resetPackage();
                            }}
                            className="h-10 w-24 rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void createInputData()}
                          disabled={loadingRecords || !fields.length}
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:brightness-105 disabled:opacity-50"
                        >
                          {loadingRecords ? "Loading…" : "Create input data"}
                        </button>
                      </div>
                      {recordsStats ? (
                        <p className="mt-3 text-xs text-muted">
                          {recordsStats.total.toLocaleString()} matching · {recordsStats.fetched.toLocaleString()} loaded
                        </p>
                      ) : null}
                      {recordsError ? <p className="mt-3 whitespace-pre-wrap text-xs text-red-700">{recordsError}</p> : null}
                    </section>

                    <section className="rounded-2xl border border-card bg-card p-4">
                      <div className="flex flex-wrap gap-2">
                        <PromptSourcesButton
                          paths={[
                            CUSTOM_EXTRACTION_BASE_PROMPT_PATH,
                            ...outputSpecs.map((field) => field.promptPath),
                            REQUESTED_OUTPUTS_PROMPT_PATH,
                            INPUT_RECORDS_PROMPT_PATH,
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => void copyPrompt()}
                          disabled={loadingPrompts || Boolean(promptError) || recordsJson === "[]" || !fields.length}
                          className={secondaryButton}
                        >
                          {copied ? "Copied ✓" : "Copy complete prompt"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(recordsJson)}
                          disabled={recordsJson === "[]"}
                          className={secondaryButton}
                        >
                          Copy data
                        </button>
                      </div>
                      {loadingPrompts ? <p className="mt-3 text-xs text-muted">Loading prompt files…</p> : null}
                      {promptError ? <p className="mt-3 text-xs text-red-700">{promptError}</p> : null}
                    </section>
                  </aside>

                  <main className="grid content-start gap-4">
                    <section className="grid gap-4 xl:grid-cols-2">
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        Input data
                        <textarea
                          readOnly
                          dir="ltr"
                          value={recordsJson}
                          className="min-h-[430px] resize-y rounded-2xl border border-card bg-card p-4 font-mono text-xs font-normal leading-6 outline-none"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        AI response
                        <textarea
                          dir="ltr"
                          value={responseText}
                          onChange={(event) => {
                            setResponseText(event.target.value);
                            setApplied(false);
                            setApplyError("");
                          }}
                          placeholder={'[{ "word_id": 123, "fields": { "imageability": 80 }, "sentences": [] }]'}
                          className="min-h-[430px] resize-y rounded-2xl border border-card bg-card p-4 font-mono text-xs font-normal leading-6 outline-none"
                        />
                      </label>
                    </section>

                    <section className="rounded-2xl border border-card bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void pasteResponse()} className={secondaryButton}>
                          Paste response
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyResponse()}
                          disabled={!responseText.trim() || applying || applied || recordsJson === "[]"}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:brightness-105 disabled:opacity-50"
                        >
                          {applying ? "Applying…" : applied ? "Applied ✓" : "Apply response"}
                        </button>
                        <span className="text-xs text-muted">Apply validates and writes immediately; there is no additional confirmation step.</span>
                      </div>
                      {applyError ? <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700">{applyError}</pre> : null}
                      {applyReport ? (
                        <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                          <div className="font-semibold">{applyReport}</div>
                          {applyDetails ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold">Apply details</summary>
                              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5">{applyDetails}</pre>
                            </details>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  </main>
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
