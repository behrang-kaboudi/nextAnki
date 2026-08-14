"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { PersianWordResolutionModal } from "@/components/words/PersianWordResolutionModal.client";
import type {
  PersianWordAmbiguity,
  PersianWordResolutionSelection,
} from "@/lib/words/persianWordResolution";

const buttonBase =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

const BASE_PROMPT_PATHS = [
  "src/prompts/word-extraction/base/rulseV1.md",
  "src/prompts/word-extraction/base_form/rulseV1.md",
  "src/prompts/word-extraction/meaning_fa/rulseV1.md",
  "src/prompts/word-extraction/pos/rulseV1.md",
  "src/prompts/word-extraction/concept_explained_fa/rulseV1.md",
  "src/prompts/word-extraction/sentence_en/rulseV1.md",
  "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
  "src/prompts/word-extraction/base/input_words_v1.md",
] as const;

const REQUIRED_FIELDS = [
  "base_form",
  "meaning_fa",
  "pos",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const;

type BaseWordRow = Record<(typeof REQUIRED_FIELDS)[number], string>;

type AuditChange = {
  entity: "WordSense" | "EnglishWord" | "PersianWord" | "Sentence";
  field: string;
  action: "created" | "reused" | "updated" | "kept" | "linked" | "removed";
  recordId?: number;
  before?: string | number | number[] | null;
  after?: string | number | number[] | null;
  incoming?: string | number | number[] | null;
  reason: string;
};

type InsertResultItem =
  | {
      ok: true;
      action: "inserted" | "skipped_exists";
      id: number;
      base_form: string;
      meaning_fa: string;
      changes: AuditChange[];
    }
  | {
      ok: false;
      action: "error";
      base_form: string;
      meaning_fa: string;
      error: string;
    };

type InsertResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  ambiguities?: PersianWordAmbiguity[];
  inserted?: number;
  skippedExisting?: number;
  failed?: number;
  total?: number;
  results?: InsertResultItem[];
};

function formatAuditValue(value: AuditChange["before"] | AuditChange["after"]) {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length ? `[${value.join(", ")}]` : "[]";
  return String(value);
}

function parseJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  const parse = (candidate: string): unknown | null => {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  };

  const direct = parse(trimmed);
  if (Array.isArray(direct)) return direct;

  for (let start = 0; start < trimmed.length; start += 1) {
    if (trimmed[start] !== "[") continue;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let end = start; end < trimmed.length; end += 1) {
      const character = trimmed[end];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "[") depth += 1;
      else if (character === "]") {
        depth -= 1;
        if (depth === 0) {
          const extracted = parse(trimmed.slice(start, end + 1));
          if (Array.isArray(extracted)) return extracted;
          break;
        }
      }
    }
  }

  throw new Error("The AI response must contain a JSON array.");
}

function validateRows(text: string): BaseWordRow[] {
  const parsed = parseJsonArray(text);
  if (parsed.length === 0) throw new Error("The JSON array is empty.");

  const allowedFields = new Set<string>(REQUIRED_FIELDS);
  const errors: string[] = [];
  const rows: BaseWordRow[] = [];

  parsed.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`Item ${index + 1} must be an object.`);
      return;
    }

    const record = item as Record<string, unknown>;
    const keys = Object.keys(record);
    const extras = keys.filter((key) => !allowedFields.has(key));
    const missing = REQUIRED_FIELDS.filter((field) => !(field in record));
    const empty = REQUIRED_FIELDS.filter(
      (field) => typeof record[field] !== "string" || !record[field].trim(),
    );

    if (extras.length) errors.push(`Item ${index + 1}: extra field(s): ${extras.join(", ")}.`);
    if (missing.length) errors.push(`Item ${index + 1}: missing field(s): ${missing.join(", ")}.`);
    if (empty.length) errors.push(`Item ${index + 1}: empty or invalid field(s): ${empty.join(", ")}.`);

    if (!extras.length && !missing.length && !empty.length && keys.length === REQUIRED_FIELDS.length) {
      rows.push({
        base_form: String(record.base_form).trim(),
        meaning_fa: String(record.meaning_fa).trim(),
        pos: String(record.pos).trim(),
        concept_explained_fa: String(record.concept_explained_fa).trim(),
        sentence_en: String(record.sentence_en).trim(),
        sentence_en_meaning_fa: String(record.sentence_en_meaning_fa).trim(),
      });
    } else if (keys.length !== REQUIRED_FIELDS.length && !extras.length && !missing.length) {
      errors.push(`Item ${index + 1} must have exactly ${REQUIRED_FIELDS.length} fields.`);
    }
  });

  if (errors.length) throw new Error(errors.slice(0, 12).join("\n"));
  return rows;
}

export default function NewWordExtractionStudio() {
  const [rawWords, setRawWords] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [clipboardBusy, setClipboardBusy] = useState<"words" | "response" | null>(null);
  const [validatedRows, setValidatedRows] = useState<BaseWordRow[]>([]);
  const [validationError, setValidationError] = useState("");
  const [insertBusy, setInsertBusy] = useState(false);
  const [insertResult, setInsertResult] = useState<InsertResponse | null>(null);
  const [insertError, setInsertError] = useState("");
  const [resolutionAmbiguities, setResolutionAmbiguities] = useState<PersianWordAmbiguity[]>([]);
  const [pendingInsertRows, setPendingInsertRows] = useState<BaseWordRow[] | null>(null);

  const resetResponseState = useCallback(() => {
    setValidatedRows([]);
    setValidationError("");
    setInsertResult(null);
    setInsertError("");
    setResolutionAmbiguities([]);
    setPendingInsertRows(null);
  }, []);

  const buildBasePrompt = useCallback(async () => {
    if (!rawWords.trim()) {
      setValidationError("Add at least one word before building the prompt.");
      return;
    }

    setPromptBusy(true);
    setValidationError("");
    setPromptCopied(false);
    try {
      const promptParts = await Promise.all(
        BASE_PROMPT_PATHS.map(async (path) => {
          const response = await fetch(`/api/ai/prompt-file?path=${encodeURIComponent(path)}`);
          const json = (await response.json().catch(() => null)) as { text?: string; error?: string } | null;
          if (!response.ok || typeof json?.text !== "string") {
            throw new Error(json?.error ?? `Failed to load ${path} (${response.status}).`);
          }
          return json.text.trim();
        }),
      );

      const prompt = `${promptParts.join("\n\n")}\n\n${rawWords.trim()}`;
      setGeneratedPrompt(prompt);
      setShowPrompt(true);
      await navigator.clipboard.writeText(prompt);
      setPromptCopied(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
    } finally {
      setPromptBusy(false);
    }
  }, [rawWords]);

  const copyGeneratedPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setPromptCopied(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
    }
  }, [generatedPrompt]);

  const pasteWords = useCallback(async () => {
    setClipboardBusy("words");
    try {
      setRawWords(await navigator.clipboard.readText());
      setGeneratedPrompt("");
      setValidationError("");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
    } finally {
      setClipboardBusy(null);
    }
  }, []);

  const pasteResponse = useCallback(async () => {
    setClipboardBusy("response");
    try {
      setAiResponse(await navigator.clipboard.readText());
      resetResponseState();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
    } finally {
      setClipboardBusy(null);
    }
  }, [resetResponseState]);

  const validateResponse = useCallback(() => {
    setInsertResult(null);
    setInsertError("");
    try {
      const rows = validateRows(aiResponse);
      setValidatedRows(rows);
      setValidationError("");
      document.getElementById("extraction-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return rows;
    } catch (error) {
      setValidatedRows([]);
      setValidationError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [aiResponse]);

  const submitInsert = useCallback(async (
    rows: BaseWordRow[],
    selections: PersianWordResolutionSelection[] = [],
  ) => {
    setInsertBusy(true);
    setInsertError("");
    setInsertResult(null);
    try {
      const response = await fetch("/api/word-extraction/base/insert-tempwords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(selections.length ? { items: rows, persian_word_resolutions: selections } : rows),
      });
      const json = (await response.json().catch(() => null)) as InsertResponse | null;
      if (
        response.status === 409 &&
        json?.code === "PERSIAN_WORD_RESOLUTION_REQUIRED" &&
        Array.isArray(json.ambiguities) &&
        json.ambiguities.length
      ) {
        setPendingInsertRows(rows);
        setResolutionAmbiguities(json.ambiguities);
        return;
      }
      if (!response.ok || !json?.ok) throw new Error(json?.error ?? `Insert failed (${response.status}).`);
      setResolutionAmbiguities([]);
      setPendingInsertRows(null);
      setInsertResult(json);
    } catch (error) {
      setInsertError(error instanceof Error ? error.message : String(error));
    } finally {
      setInsertBusy(false);
    }
  }, []);

  const insertTempWords = useCallback(async () => {
    const rows = validateResponse();
    if (!rows) return;
    await submitInsert(rows);
  }, [submitInsert, validateResponse]);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
            <Link href="/words/extraction" className="transition hover:text-[var(--primary)]">Word Extraction</Link>
            <span>/</span>
            <span>New words</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">New Word Extraction</h1>
            <span className="hidden h-8 w-px bg-slate-300 sm:block" aria-hidden="true" />
            <p dir="rtl" className="max-w-xl text-right text-sm leading-7 text-muted">
              کلمات را در کارت اول وارد کن، پرامپت را برای AI بفرست و پاسخ را در کارت دوم قرار بده.
            </p>
          </div>
        </div>
        <Link href="/words/extraction/legacy" className={`${buttonBase} border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100`}>
          Open legacy page
        </Link>
      </header>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Word extraction workspace">
        <article className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
          <div className="border-b border-card px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-sm font-bold text-white">1</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">Words / Prompt</p>
                <h2 dir="rtl" className="mt-0.5 text-right font-bold text-foreground">فاز ۱ استخراج از کلمات</h2>
                <p dir="rtl" className="mt-1 text-right text-xs leading-5 text-muted">
                  فقط برای کلمات است؛ یعنی مرتب‌سازی و استخراج داده‌ی پایه‌ی کلمات، نه پردازش‌های بعدی.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5">
            <label className="grid gap-2">
              <span className="text-xs font-semibold text-foreground">Raw words</span>
              <textarea
                dir="auto"
                value={rawWords}
                onChange={(event) => {
                  setRawWords(event.target.value);
                  setGeneratedPrompt("");
                  setPromptCopied(false);
                }}
                className="min-h-[360px] w-full resize-y rounded-2xl border border-card bg-background p-4 font-mono text-sm leading-7 text-foreground outline-none placeholder:text-muted focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
                placeholder={"One word or phrase per line…\n\nresilient — انعطاف‌پذیر\ntake into account — در نظر گرفتن\nsubtle"}
              />
            </label>
            <p dir="rtl" className="text-right text-xs leading-6 text-muted">معنی فارسی اختیاری است. هر کلمه یا عبارت را در یک خط جدا بنویس.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void buildBasePrompt()} disabled={promptBusy || !rawWords.trim()} className={`${buttonBase} w-full bg-[var(--primary)] text-white shadow-sm hover:brightness-105`}>
                {promptBusy ? "BUILDING PROMPT..." : promptCopied ? "1.1 PROMPT COPIED — READY FOR AI" : "1.1 PROMPT FOR: CONVERT WORDS TO GET BASEDATA FROM AI"}
              </button>
              <button type="button" onClick={() => void pasteWords()} disabled={clipboardBusy !== null} className={`${buttonBase} border border-card bg-background text-foreground hover:bg-slate-50`}>
                {clipboardBusy === "words" ? "Pasting..." : "Paste words"}
              </button>
              <button type="button" onClick={() => { setRawWords(""); setGeneratedPrompt(""); setPromptCopied(false); }} disabled={!rawWords} className={`${buttonBase} border border-card bg-background text-muted hover:bg-slate-50`}>
                Clear
              </button>
              {generatedPrompt ? (
                <button type="button" onClick={() => setShowPrompt(true)} className={`${buttonBase} border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100`}>
                  View generated prompt
                </button>
              ) : null}
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
          <div className="border-b border-card px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white">2</span>
              <div>
                <h2 className="font-bold text-foreground">AI Response</h2>
                <p dir="rtl" className="mt-0.5 text-right text-xs text-muted">پاسخ JSON هوش مصنوعی را اینجا Paste کن.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5">
            <label className="grid gap-2">
              <span className="text-xs font-semibold text-foreground">Guide / Output</span>
              <textarea
                dir="ltr"
                value={aiResponse}
                onChange={(event) => {
                  setAiResponse(event.target.value);
                  resetResponseState();
                }}
                className="min-h-[360px] w-full resize-y rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 font-mono text-sm leading-7 text-foreground outline-none placeholder:text-emerald-800/45 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200"
                placeholder={'Paste the AI response here…\n\n[\n  { "base_form": "...", "meaning_fa": "...", "pos": "...", "concept_explained_fa": "...", "sentence_en": "...", "sentence_en_meaning_fa": "..." }\n]'}
              />
            </label>
            <p dir="rtl" className="text-right text-xs leading-6 text-muted">
              پاسخ باید شامل کلمه، معنی اصلی، نقش دستوری، توضیح مفهوم، جملهٔ انگلیسی و ترجمهٔ فارسی جمله باشد.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void insertTempWords()} disabled={insertBusy || !aiResponse.trim()} className={`${buttonBase} w-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-500`}>
                {insertBusy ? "INSERTING..." : "1.2 INSERT BASE FORTEMPWORDS"}
              </button>
              <button type="button" onClick={() => void pasteResponse()} disabled={clipboardBusy !== null} className={`${buttonBase} border border-card bg-background text-foreground hover:bg-slate-50`}>
                {clipboardBusy === "response" ? "Pasting..." : "Paste AI response"}
              </button>
              <button type="button" onClick={validateResponse} disabled={!aiResponse.trim()} className={`${buttonBase} border border-card bg-background text-foreground hover:bg-slate-50`}>
                Validate response
              </button>
            </div>
          </div>
        </article>
      </section>

      {validationError ? (
        <section className="whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800" role="alert">
          {validationError}
        </section>
      ) : null}

      {insertError ? (
        <section className="whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800" role="alert">
          {insertError}
        </section>
      ) : null}

      {insertResult?.ok ? (
        <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-elevated" role="status">
          <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="font-semibold text-emerald-900">Database operation completed</p>
            <p className="mt-1 text-sm text-emerald-800">
              Inserted: {insertResult.inserted ?? 0} · Not inserted (same base form + meaning + POS): {insertResult.skippedExisting ?? 0} · Failed: {insertResult.failed ?? 0} · Total: {insertResult.total ?? 0}
            </p>
            <p dir="rtl" className="mt-2 text-right text-xs leading-6 text-emerald-900/70">
              جزئیات زیر نشان می‌دهد هر رکورد و فیلد ساخته، استفادهٔ مجدد، تغییر، حفظ یا حذف شده است.
            </p>
          </div>
          <div className="grid gap-4 p-5">
            {(insertResult.results ?? []).map((result, resultIndex) => (
              <article key={`${result.base_form}-${result.meaning_fa}-${resultIndex}`} className="overflow-hidden rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{result.base_form}</span>
                    <span dir="rtl" className="text-sm text-slate-600">{result.meaning_fa}</span>
                    {result.ok ? <span className="text-xs text-slate-400">WordSense #{result.id}</span> : null}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    result.action === "inserted"
                      ? "bg-blue-100 text-blue-800"
                      : result.action === "skipped_exists"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
                  }`}>
                    {result.action === "inserted" ? "WordSense inserted" : result.action === "skipped_exists" ? "Not inserted — same key" : "Failed"}
                  </span>
                </div>
                {result.ok ? (
                  <div className="divide-y divide-slate-100">
                    {result.changes.map((change, changeIndex) => (
                      <div key={`${change.entity}-${change.field}-${changeIndex}`} className="grid gap-2 px-4 py-3 lg:grid-cols-[180px_100px_minmax(0,1fr)] lg:items-start">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{change.entity}.{change.field}</p>
                          {change.recordId ? <p className="mt-1 text-[10px] text-slate-400">Record #{change.recordId}</p> : null}
                        </div>
                        <span className={`w-fit rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                          change.action === "created" || change.action === "linked"
                            ? "bg-blue-50 text-blue-700"
                            : change.action === "updated"
                              ? "bg-emerald-50 text-emerald-700"
                              : change.action === "removed"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-600"
                        }`}>
                          {change.action}
                        </span>
                        <div className="min-w-0">
                          {(change.before !== undefined || change.after !== undefined) ? (
                            <div className="mb-1.5 grid gap-1 font-mono text-[11px] text-slate-600 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                              <span className="break-words rounded bg-slate-50 px-2 py-1">{formatAuditValue(change.before)}</span>
                              <span className="text-slate-300">→</span>
                              <span className="break-words rounded bg-slate-50 px-2 py-1">{formatAuditValue(change.after)}</span>
                            </div>
                          ) : null}
                          {change.incoming !== undefined ? (
                            <p className="mb-1.5 break-words rounded bg-amber-50 px-2 py-1 font-mono text-[11px] text-amber-800">
                              Incoming: {formatAuditValue(change.incoming)}
                            </p>
                          ) : null}
                          <p dir="rtl" className="text-right text-xs leading-6 text-slate-600">{change.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap px-4 py-3 text-sm text-red-700">{result.error}</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="extraction-review" className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Review extracted words</h2>
            <p dir="rtl" className="mt-1 text-right text-xs leading-6 text-muted">پاسخ معتبر اینجا نمایش داده می‌شود؛ دکمهٔ 1.2 آن را در دیتابیس ثبت می‌کند.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${validatedRows.length ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {validatedRows.length ? `${validatedRows.length} valid record(s)` : "Not validated"}
          </span>
        </div>
        {validatedRows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">base_form</th>
                  <th className="px-4 py-3 font-semibold">meaning_fa</th>
                  <th className="px-4 py-3 font-semibold">pos</th>
                  <th className="px-4 py-3 font-semibold">concept_explained_fa</th>
                  <th className="px-4 py-3 font-semibold">sentence_en</th>
                  <th className="px-4 py-3 font-semibold">sentence_en_meaning_fa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validatedRows.map((row, index) => (
                  <tr key={`${row.base_form}-${row.meaning_fa}-${index}`}>
                    <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.base_form}</td>
                    <td dir="rtl" className="px-4 py-3 text-right text-slate-700">{row.meaning_fa}</td>
                    <td className="px-4 py-3 text-slate-700">{row.pos}</td>
                    <td dir="rtl" className="px-4 py-3 text-right leading-5 text-slate-700">{row.concept_explained_fa}</td>
                    <td className="px-4 py-3 leading-5 text-slate-700">{row.sentence_en}</td>
                    <td dir="rtl" className="px-4 py-3 text-right leading-5 text-slate-700">{row.sentence_en_meaning_fa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted">Paste an AI response and select Validate response.</p>
          </div>
        )}
      </section>

      {showPrompt ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="generated-prompt-title">
          <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-card bg-card shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card px-5 py-4">
              <div>
                <h2 id="generated-prompt-title" className="font-bold text-foreground">Generated base-data prompt</h2>
                <p className="mt-1 text-xs text-muted">{BASE_PROMPT_PATHS.length} prompt files + your raw words</p>
              </div>
              <div className="flex gap-2">
                <PromptSourcesButton paths={BASE_PROMPT_PATHS} />
                <button type="button" onClick={() => void copyGeneratedPrompt()} className={`${buttonBase} bg-[var(--primary)] text-white`}>
                  {promptCopied ? "Copied" : "Copy prompt"}
                </button>
                <button type="button" onClick={() => setShowPrompt(false)} className={`${buttonBase} border border-card bg-background text-foreground`}>
                  Close
                </button>
              </div>
            </div>
            <textarea readOnly dir="auto" value={generatedPrompt} className="min-h-0 flex-1 resize-none bg-background p-5 font-mono text-xs leading-6 text-foreground outline-none" />
          </div>
        </div>
      ) : null}
      <PersianWordResolutionModal
        ambiguities={resolutionAmbiguities}
        busy={insertBusy}
        onCancel={() => {
          setResolutionAmbiguities([]);
          setPendingInsertRows(null);
          setInsertError("Import cancelled; no ambiguous record was saved.");
        }}
        onConfirm={(selections) => {
          if (pendingInsertRows) void submitInsert(pendingInsertRows, selections);
        }}
      />
    </main>
  );
}
