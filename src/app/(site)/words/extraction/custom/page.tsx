"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ModalPortal } from "@/components/modal-portal";
import {
  CUSTOM_EXTRACTION_BASE_PROMPT_PATH,
  CUSTOM_EXTRACTION_INPUT_FIELDS,
  CUSTOM_EXTRACTION_OUTPUT_FIELDS,
  type CustomExtractionFieldKey,
} from "@/lib/word-extraction/customExtractionFields";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";

const REQUESTED_OUTPUTS_PROMPT_PATH = "custom-extraction/requested_outputs_v1.md";
const INPUT_RECORDS_PROMPT_PATH = "custom-extraction/input_records_v1.md";

type PromptTexts = Record<string, string>;
type RecordsResponse = {
  ok?: boolean;
  error?: string;
  total?: number;
  fetched?: number;
  items?: unknown[];
};

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50";

const outputFieldKeys = new Set(
  CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => field.key),
);

const FIELD_POPULATION_GUIDE: Record<
  CustomExtractionFieldKey,
  { when: string; how: string }
> = {
  base_form: {
    when: "Requested only when EnglishWord.base_form is empty.",
    how: "The base-form prompt asks the AI to normalize the English word or phrase. Apply response updates the linked EnglishWord record.",
  },
  meaning_fa: {
    when: "Requested when the WordSense has no primary Persian meaning, or the linked PersianWord text is empty.",
    how: "The meaning prompt asks the AI for the primary Persian meaning. Apply response reuses or creates a PersianWord and connects it through WordSense.meaningId.",
  },
  other_meanings_fa: {
    when: "Counted as pending while WordSense.meanings_confirmed is false, even when otherMeaningIds already contains values. It becomes an AI output once a primary Persian meaning exists.",
    how: "The field prompt reviews the exact word sense and returns a JSON array of alternative meanings, or an empty array. Apply response reuses or creates the PersianWord records, replaces otherMeaningIds, and sets meanings_confirmed to true.",
  },
  sentence_en: {
    when: "Requested when WordSense.sentenceIds is null, empty, or contains no sentence IDs.",
    how: "The AI returns one new sentence with sentence_id: null. Apply response reuses an exact matching Sentence or creates one, then adds its ID to WordSense.sentenceIds.",
  },
  sentence_en_meaning_fa: {
    when: "Requested for linked sentences whose Persian translation is empty. It is also requested for a newly generated sentence when both sentence outputs are selected.",
    how: "The AI translates each identified English sentence. Apply response updates Sentence.sentence_en_meaning_fa and clears its old translation audio when the text changes.",
  },
  phonetic_us: {
    when: "Requested when EnglishWord.phonetic_us is null or empty.",
    how: "The phonetic prompt generates American IPA. Apply response stores both the display IPA and its normalized form, and clears the old JSON hint.",
  },
  meaning_fa_IPA: {
    when: "Requested when a primary PersianWord exists and meaning_fa_IPA is null or empty.",
    how: "The Persian-IPA prompt generates pronunciation for the primary Persian meaning. Apply response stores the IPA and its normalized form on PersianWord.",
  },
  imageability: {
    when: "Requested when WordSense.imageability is null or 0.",
    how: "The imageability prompt asks the AI for an integer score from 0 to 100. Zero is accepted, but is treated as missing and will be selected again later.",
  },
  learning_depth: {
    when: "Requested when WordSense.learning_depth is null or 0.",
    how: "The learning-depth prompt asks the AI for -100 or a score from 0 to 1. Zero is treated as missing and will be selected again later.",
  },
  productive_target: {
    when: "Requested when WordSense.productive_target is null or 0.",
    how: "The productive-target prompt asks the AI for an integer from 0 to 101. Zero is treated as missing and will be selected again later.",
  },
  pos: {
    when: "Requested when WordSense.pos is null or empty.",
    how: "The part-of-speech prompt asks the AI for the grammatical role that matches this exact word sense, then Apply response writes it to WordSense.pos.",
  },
  concept_explained_fa: {
    when: "Requested when WordSense.concept_explained_fa is null or empty.",
    how: "The concept prompt asks the AI for a Persian explanation of this exact sense. Apply response writes it to WordSense.concept_explained_fa.",
  },
  other_meanings_en: {
    when: "Counted as pending when WordSense.other_meanings_en is null or empty. It is context only on this page and is not currently available under Fields to fill.",
    how: "Selecting it as an input sends the existing value to the AI as context. Custom Extraction does not change this field because no output prompt or apply rule is registered for it.",
  },
  category: {
    when: "Counted as pending when WordSense.category is null or empty. It is context only on this page and is not currently available under Fields to fill.",
    how: "Selecting it as an input sends the existing value to the AI as context. Custom Extraction does not change this field because no output prompt or apply rule is registered for it.",
  },
  hint_to_select: {
    when: "Counted as pending when WordSense.hint_to_select is null or empty. It is context only on this page and is not currently available under Fields to fill.",
    how: "Selecting it as an input sends the existing value to the AI as context. Custom Extraction does not change this field because no output prompt or apply rule is registered for it.",
  },
};

function FieldCard({
  checked,
  label,
  source,
  pendingCount,
  pendingCriterion,
  onChange,
}: {
  checked: boolean;
  label: string;
  source: string;
  pendingCount?: number;
  pendingCriterion: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
        checked
          ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary),transparent_90%)] shadow-sm"
          : "border-card bg-background hover:border-[color-mix(in_oklab,var(--primary),transparent_55%)]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="rounded-full border border-card bg-card px-2 py-0.5 text-[10px] font-semibold text-muted">
            {source}
          </span>
          <span
            className={`group relative rounded-full px-2 py-0.5 text-[10px] font-semibold ${pendingCount === 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}
            aria-label={pendingCount === undefined ? "در حال شمارش کارهای باقی‌مانده برای این فیلد" : `${pendingCount.toLocaleString("en-US")} رکورد نیازمند انجام کار این فیلد`}
          >
            {pendingCount === undefined ? "Pending …" : `Pending · ${pendingCount.toLocaleString("en-US")}`}
            <span
              role="tooltip"
              dir="rtl"
              className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-background opacity-0 shadow-elevated transition-opacity delay-100 duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              تعداد رکوردهایی که کار این فیلد هنوز برایشان کامل نشده است
            </span>
          </span>
        </span>
        <span className="mt-1.5 block text-[11px] leading-4 text-muted">
          {pendingCriterion}
        </span>
      </span>
    </label>
  );
}

export default function CustomWordExtractionPage() {
  const [inputFields, setInputFields] = useState<CustomExtractionFieldKey[]>([
    "base_form",
    "meaning_fa",
    "sentence_en",
  ]);
  const [outputFields, setOutputFields] = useState<CustomExtractionFieldKey[]>([
    "sentence_en",
    "concept_explained_fa",
  ]);
  const [limit, setLimit] = useState("20");
  const [promptTexts, setPromptTexts] = useState<PromptTexts>({});
  const [promptError, setPromptError] = useState("");
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [recordsJson, setRecordsJson] = useState("[]");
  const [recordsStats, setRecordsStats] = useState<{ total: number; fetched: number } | null>(null);
  const [recordsError, setRecordsError] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeFieldTab, setActiveFieldTab] = useState<"inputs" | "outputs">("inputs");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<"prompts" | "data">("data");
  const [fieldPendingCounts, setFieldPendingCounts] = useState<Partial<Record<CustomExtractionFieldKey, number>>>({});
  const [fieldCountsError, setFieldCountsError] = useState("");
  const [responseText, setResponseText] = useState("");
  const [applyingResponse, setApplyingResponse] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applyReport, setApplyReport] = useState("");
  const [applyDetails, setApplyDetails] = useState("");
  const [showApplyDetails, setShowApplyDetails] = useState(false);
  const [showPageHelp, setShowPageHelp] = useState(false);

  useEffect(() => {
    if (!showPageHelp && !showApplyDetails) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPageHelp(false);
      if (event.key === "Escape") setShowApplyDetails(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showApplyDetails, showPageHelp]);

  const selectedOutputSpecs = useMemo(
    () => CUSTOM_EXTRACTION_OUTPUT_FIELDS.filter((field) => outputFields.includes(field.key)),
    [outputFields],
  );

  useEffect(() => {
    let canceled = false;
    fetch("/api/word-extraction/custom/field-counts", { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          counts?: Partial<Record<CustomExtractionFieldKey, number>>;
        } | null;
        if (!response.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${response.status})`);
        if (!canceled) setFieldPendingCounts(json.counts ?? {});
      })
      .catch((error) => {
        if (!canceled) setFieldCountsError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const paths = [
      CUSTOM_EXTRACTION_BASE_PROMPT_PATH,
      ...selectedOutputSpecs.map((field) => field.promptPath),
      REQUESTED_OUTPUTS_PROMPT_PATH,
      INPUT_RECORDS_PROMPT_PATH,
    ];
    setLoadingPrompts(true);
    setPromptError("");
    Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`/api/ai/prompt-file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
        const json = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
        if (!response.ok) throw new Error(json?.error ?? `Could not load ${path}`);
        return [path, String(json?.text ?? "")] as const;
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
  }, [selectedOutputSpecs]);

  const promptOnly = useMemo(() => {
    const base = promptTexts[CUSTOM_EXTRACTION_BASE_PROMPT_PATH]?.trim() ?? "";
    const fieldRules = selectedOutputSpecs
      .map((field) => {
        const text = promptTexts[field.promptPath]?.trim();
        return text ?? "";
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
    const requestedOutputsPrompt = promptTexts[REQUESTED_OUTPUTS_PROMPT_PATH]?.trim() ?? "";
    return [base, fieldRules, `${requestedOutputsPrompt}\n${JSON.stringify(outputFields, null, 2)}`]
      .filter(Boolean)
      .join("\n\n---\n\n");
  }, [outputFields, promptTexts, selectedOutputSpecs]);

  const inputRecordsPrompt = promptTexts[INPUT_RECORDS_PROMPT_PATH]?.trim() ?? "";
  const combinedPrompt = `${promptOnly}\n\n---\n\n${inputRecordsPrompt}\n${recordsJson}`;

  function toggleField(
    key: CustomExtractionFieldKey,
    checked: boolean,
    setFields: React.Dispatch<React.SetStateAction<CustomExtractionFieldKey[]>>,
  ) {
    setFields((current) => checked ? [...current, key] : current.filter((field) => field !== key));
    setRecordsJson("[]");
    setRecordsStats(null);
    setRecordsError("");
    setResponseText("");
    setApplyError("");
    setApplyReport("");
    setApplyDetails("");
    setShowApplyDetails(false);
    setCopied(false);
  }

  async function createInputData() {
    if (!inputFields.length || !outputFields.length) return;
    setLoadingRecords(true);
    setRecordsError("");
    setResponseText("");
    setApplyError("");
    setApplyReport("");
    setApplyDetails("");
    setShowApplyDetails(false);
    setCopied(false);
    try {
      const params = new URLSearchParams({
        inputs: inputFields.join(","),
        outputs: outputFields.join(","),
        limit,
      });
      const response = await fetch(`/api/word-extraction/custom/records?${params}`, { cache: "no-store" });
      const json = (await response.json().catch(() => null)) as RecordsResponse | null;
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${response.status})`);
      setRecordsJson(JSON.stringify(json.items ?? [], null, 2));
      setRecordsStats({ total: json.total ?? 0, fetched: json.fetched ?? 0 });
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingRecords(false);
    }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(combinedPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function pasteResponse() {
    setApplyError("");
    try {
      setResponseText(await navigator.clipboard.readText());
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : String(error));
    }
  }

  async function applyResponse() {
    setApplyingResponse(true);
    setApplyError("");
    setApplyReport("");
    setApplyDetails("");
    setShowApplyDetails(false);
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
        body: JSON.stringify({ outputs: outputFields, requests, items }),
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
        throw new Error(`${json?.error ?? `Request failed (${response.status})`}${details}`);
      }
      setApplyReport(`${json.updated ?? 0} of ${json.total ?? 0} records applied${json.failed ? ` · ${json.failed} failed` : ""}.`);
      setApplyDetails(JSON.stringify(json.results ?? [], null, 2));

      const countsResponse = await fetch("/api/word-extraction/custom/field-counts", { cache: "no-store" });
      const countsJson = (await countsResponse.json().catch(() => null)) as {
        ok?: boolean;
        counts?: Partial<Record<CustomExtractionFieldKey, number>>;
      } | null;
      if (countsResponse.ok && countsJson?.ok) setFieldPendingCounts(countsJson.counts ?? {});
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplyingResponse(false);
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Custom Word Extraction"
        titleAccessory={(
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/words/extraction/new"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
            >
              New Word Intake
            </Link>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={showPageHelp}
              onClick={() => setShowPageHelp(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary),transparent_90%)] px-5 py-2 text-sm font-bold text-[var(--primary)] shadow-sm transition hover:brightness-95 active:scale-[0.98]"
            >
              Guide to Field Population
            </button>
          </div>
        )}
      />

      {showPageHelp ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-population-guide-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowPageHelp(false);
            }}
          >
            <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-card bg-background shadow-elevated">
              <header className="flex items-start justify-between gap-4 border-b border-card p-5 sm:p-6">
                <div>
                  <h2 id="field-population-guide-title" className="text-xl font-bold text-foreground">
                    Guide to Field Population
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
                    How Custom Extraction decides which records and fields need AI work, how the prompt is assembled, and what happens when the response is applied.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPageHelp(false)}
                  className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </header>

              <div className="overflow-y-auto p-5 sm:p-6">
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    ["1. Choose context", "Input fields control optional context sent to the AI. Selecting an input never updates it; an output workflow may also include mandatory context required by its field prompt."],
                    ["2. Choose outputs", "Fields to fill are the only fields the AI may return. Each selected output loads its own field-specific prompt file."],
                    ["3. Create and run", "Create input data selects the newest Words missing at least one chosen output. Copy complete prompt combines the orchestrator, field rules, requested outputs, and records."],
                    ["4. Validate and apply", "Paste the AI JSON response. Apply response validates word IDs, requested fields, sentence IDs, value ranges, and response shape before writing."],
                  ].map(([title, text]) => (
                    <article key={title} className="rounded-2xl border border-card bg-card p-4">
                      <h3 className="text-sm font-bold text-foreground">{title}</h3>
                      <p className="mt-2 text-xs leading-5 text-muted">{text}</p>
                    </article>
                  ))}
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-card">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className="bg-card text-foreground">
                        <tr className="border-b border-card">
                          <th className="px-4 py-3">Field</th>
                          <th className="px-4 py-3">Stored on</th>
                          <th className="px-4 py-3">Availability</th>
                          <th className="px-4 py-3">When it is requested</th>
                          <th className="px-4 py-3">How it is populated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CUSTOM_EXTRACTION_INPUT_FIELDS.map((field) => {
                          const guide = FIELD_POPULATION_GUIDE[field.key];
                          const outputSpec = CUSTOM_EXTRACTION_OUTPUT_FIELDS.find(
                            (candidate) => candidate.key === field.key,
                          );
                          return (
                            <tr key={field.key} className="border-b border-card align-top last:border-b-0">
                              <td className="px-4 py-3">
                                <code className="font-semibold text-foreground">{field.key}</code>
                                <div className="mt-1 text-muted">{field.description}</div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-foreground">{field.source}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 font-semibold ${
                                    outputFieldKeys.has(field.key)
                                      ? "bg-emerald-500/10 text-emerald-700"
                                      : "bg-slate-500/10 text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {outputFieldKeys.has(field.key) ? "AI output" : "Input context only"}
                                </span>
                                {outputSpec ? (
                                  <div className="mt-2 max-w-52 break-all font-mono text-[10px] text-muted">
                                    {outputSpec.promptPath}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 leading-5 text-muted">{guide.when}</td>
                              <td className="px-4 py-3 leading-5 text-muted">{guide.how}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-900 dark:text-amber-200">
                  <strong>Important:</strong> a record can be included because one selected output is missing while its other selected outputs are already complete. The generated <code>requested_outputs</code> array is authoritative for each record, so the AI must return only those missing fields and Apply response will reject extra or omitted fields.
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}

      {showApplyDetails && applyDetails ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="apply-details-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowApplyDetails(false);
            }}
          >
            <section className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-card bg-background shadow-elevated">
              <header className="flex items-center justify-between gap-4 border-b border-card p-5">
                <div>
                  <h2 id="apply-details-title" className="text-lg font-bold text-foreground">Apply details</h2>
                  <p className="mt-1 text-sm text-muted">{applyReport}</p>
                </div>
                <button type="button" onClick={() => setShowApplyDetails(false)} className={secondaryButton}>
                  Close
                </button>
              </header>
              <div className="overflow-y-auto p-5">
                <pre className="whitespace-pre-wrap break-words rounded-2xl border border-card bg-card p-4 font-mono text-xs leading-6 text-foreground">
                  {applyDetails}
                </pre>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <aside className="grid content-start gap-5">
          <section className="rounded-3xl border border-card bg-card p-5 shadow-elevated">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Extraction fields</h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex h-8 items-center gap-1.5 rounded-lg border border-card bg-background px-2.5 text-[11px] font-medium text-muted">
                  Count
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    className="w-12 bg-transparent text-xs font-semibold text-foreground outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void createInputData()}
                  disabled={loadingRecords || !inputFields.length || !outputFields.length}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--primary)] px-3 text-[11px] font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:brightness-105 disabled:opacity-50"
                >
                  {loadingRecords ? "Loading…" : "Create input data"}
                </button>
                {recordsStats ? (
                  <span dir="rtl" className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-800">
                    <strong>{recordsStats.total.toLocaleString("en-US")}</strong>&nbsp;مطابق ·&nbsp;<strong>{recordsStats.fetched.toLocaleString("en-US")}</strong>&nbsp;بارگذاری
                  </span>
                ) : null}
              </div>
            </div>
            {recordsError ? <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-700">{recordsError}</div> : null}

            <div role="tablist" aria-label="Extraction field type" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-card bg-background p-1.5">
              <button
                type="button"
                role="tab"
                aria-selected={activeFieldTab === "inputs"}
                onClick={() => setActiveFieldTab("inputs")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeFieldTab === "inputs" ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-elevated" : "text-muted hover:bg-card hover:text-foreground"}`}
              >
                Input fields
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${activeFieldTab === "inputs" ? "bg-white/20" : "bg-card"}`}>{inputFields.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeFieldTab === "outputs"}
                onClick={() => setActiveFieldTab("outputs")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeFieldTab === "outputs" ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-elevated" : "text-muted hover:bg-card hover:text-foreground"}`}
              >
                Fields to fill
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${activeFieldTab === "outputs" ? "bg-white/20" : "bg-card"}`}>{outputFields.length}</span>
              </button>
            </div>

            {fieldCountsError ? <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700">{fieldCountsError}</div> : null}

            {activeFieldTab === "inputs" ? (
              <div role="tabpanel" className="grid gap-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-base font-semibold text-foreground">Input fields</h3>
                  <p dir="rtl" className="text-xs leading-5 text-muted">اطلاعات انتخاب‌شده و زمینهٔ ضروریِ خروجی‌ها برای AI ارسال می‌شود.</p>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-card bg-background p-3">
                  <input type="checkbox" checked disabled className="h-4 w-4 accent-[var(--primary)]" />
                  <div>
                    <div className="text-sm font-semibold text-foreground">Record ID</div>
                    <div className="text-xs text-muted">Required for matching the response</div>
                  </div>
                  <span className="ml-auto rounded-full border border-card px-2 py-0.5 text-[10px] font-semibold text-muted">LOCKED</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {CUSTOM_EXTRACTION_INPUT_FIELDS.map((field) => (
                    <FieldCard
                      key={field.key}
                      label={field.label}
                      source={field.source}
                      pendingCount={fieldPendingCounts[field.key]}
                      pendingCriterion={FIELD_POPULATION_GUIDE[field.key].when}
                      checked={inputFields.includes(field.key)}
                      onChange={(checked) => toggleField(field.key, checked, setInputFields)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div role="tabpanel" className="grid gap-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-base font-semibold text-foreground">Fields to fill</h3>
                  <p dir="rtl" className="text-xs leading-5 text-muted">هر خروجی، قانون خودش را از فایل prompt می‌گیرد.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {CUSTOM_EXTRACTION_OUTPUT_FIELDS.map((field) => (
                    <FieldCard
                      key={field.key}
                      label={field.label}
                      source={field.source}
                      pendingCount={fieldPendingCounts[field.key]}
                      pendingCriterion={FIELD_POPULATION_GUIDE[field.key].when}
                      checked={outputFields.includes(field.key)}
                      onChange={(checked) => toggleField(field.key, checked, setOutputFields)}
                    />
                  ))}
                </div>
              </div>
            )}

          </section>
        </aside>

        <main className="grid content-start gap-5">
          <section className="rounded-3xl border border-card bg-card p-5 shadow-elevated">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Create extraction package</h2>
              <div className="flex flex-wrap items-center gap-2">
                <PromptSourcesButton
                  paths={[
                    CUSTOM_EXTRACTION_BASE_PROMPT_PATH,
                    ...selectedOutputSpecs.map((field) => field.promptPath),
                    REQUESTED_OUTPUTS_PROMPT_PATH,
                    INPUT_RECORDS_PROMPT_PATH,
                  ]}
                />
                <button type="button" onClick={() => void copyAll()} disabled={loadingPrompts || !promptOnly || !outputFields.length} className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:brightness-105 disabled:opacity-50">
                  {copied ? "Copied ✓" : "Copy complete prompt"}
                </button>
                <button type="button" onClick={() => void navigator.clipboard.writeText(recordsJson)} disabled={recordsJson === "[]"} className="inline-flex h-9 items-center justify-center rounded-lg border border-card bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-card disabled:opacity-50">
                  Copy data
                </button>
              </div>
            </div>
            <div role="tablist" aria-label="Extraction package content" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-card bg-background p-1.5">
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === "data"}
                onClick={() => setActiveWorkspaceTab("data")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeWorkspaceTab === "data" ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-elevated" : "text-muted hover:bg-card hover:text-foreground"}`}
              >
                Input data
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${activeWorkspaceTab === "data" ? "bg-white/20" : "bg-card"}`}>{recordsStats?.fetched ?? 0}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeWorkspaceTab === "prompts"}
                onClick={() => setActiveWorkspaceTab("prompts")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${activeWorkspaceTab === "prompts" ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-elevated" : "text-muted hover:bg-card hover:text-foreground"}`}
              >
                Prompts
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${activeWorkspaceTab === "prompts" ? "bg-white/20" : "bg-card"}`}>{selectedOutputSpecs.length + 3}</span>
              </button>
            </div>

            {promptError ? <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-700">{promptError}</div> : null}

            {activeWorkspaceTab === "prompts" ? (
              <div role="tabpanel" className="grid gap-5">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Initial orchestrator prompt</div>
                      <div className="text-xs text-muted">{CUSTOM_EXTRACTION_BASE_PROMPT_PATH}</div>
                    </div>
                    {loadingPrompts ? <span className="text-xs font-semibold text-muted">Loading prompts…</span> : null}
                  </div>
                  <textarea readOnly dir="ltr" value={promptTexts[CUSTOM_EXTRACTION_BASE_PROMPT_PATH] ?? ""} className="min-h-64 w-full resize-y rounded-2xl border border-card bg-background p-4 font-mono text-xs leading-6 text-foreground outline-none" />
                </div>

                <div className="border-t border-card pt-5">
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-foreground">Field prompts</div>
                    <div dir="rtl" className="text-right text-xs text-muted">پرامپت‌های قبلی بدون تغییر، بعد از prompt اولیه قرار می‌گیرند.</div>
                  </div>
                  {selectedOutputSpecs.length ? (
                    <div className="grid gap-4">
                      {selectedOutputSpecs.map((field, index) => (
                        <details key={field.key} open={index === 0} className="rounded-2xl border border-card bg-background p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-foreground">
                            {index + 1}. {field.label} <span className="ml-2 text-xs font-normal text-muted">{field.promptPath}</span>
                          </summary>
                          <textarea readOnly dir="ltr" value={promptTexts[field.promptPath] ?? ""} className="mt-3 min-h-56 w-full resize-y rounded-xl border border-card bg-card p-3 font-mono text-xs leading-6 text-foreground outline-none" />
                        </details>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-card bg-background p-8 text-center text-sm text-muted">Select at least one output field.</div>
                  )}
                </div>
              </div>
            ) : (
              <div role="tabpanel">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="grid content-start gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-foreground">Input data</span>
                        <span className="text-xs text-muted">Structured records sent to the model.</span>
                      </div>
                    </div>
                    <textarea readOnly dir="ltr" value={recordsJson} className="min-h-[560px] w-full resize-y rounded-2xl border border-card bg-background p-4 font-mono text-xs leading-6 text-foreground outline-none" />
                  </div>
                  <div className="grid content-start gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-foreground">AI response</span>
                        <span className="text-xs text-muted">Paste the unified JSON response, validate it, then apply.</span>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void pasteResponse()} className={secondaryButton}>Paste response</button>
                        <button type="button" onClick={() => void applyResponse()} disabled={!responseText.trim() || applyingResponse} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:brightness-105 disabled:opacity-50">
                          {applyingResponse ? "Applying…" : "Apply response"}
                        </button>
                      </div>
                    </div>
                    {applyReport ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800">
                        <span>{applyReport}</span>
                        {applyDetails ? (
                          <button
                            type="button"
                            aria-haspopup="dialog"
                            onClick={() => setShowApplyDetails(true)}
                            className="rounded-lg border border-emerald-700/25 bg-background/70 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-background"
                          >
                            Click for more details
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <textarea
                      dir="ltr"
                      value={responseText}
                      onChange={(event) => setResponseText(event.target.value)}
                      placeholder={'[{\n  "word_id": 123,\n  "fields": {},\n  "sentences": [{"sentence_id": 456, "sentence_en_meaning_fa": "..."}]\n}]'}
                      className="min-h-[560px] w-full resize-y rounded-2xl border border-card bg-background p-4 font-mono text-xs leading-6 text-foreground outline-none focus:border-[var(--primary)]"
                    />
                    {applyError ? <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-700">{applyError}</pre> : null}
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
