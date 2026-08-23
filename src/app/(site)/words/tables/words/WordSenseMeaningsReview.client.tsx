"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/icons/ActionIcon";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { PromptBatchControls } from "@/components/prompts/PromptBatchControls.client";
import { RemainingCountBadge, RemainingCountButton } from "@/components/remaining-count";
import { BulkReviewStatusActions } from "@/components/review-status/BulkReviewStatusActions.client";
import { combinePromptParts } from "@/lib/ai/promptPolicy";
import { completeAgentArtifact, usePendingAgentArtifact } from "@/lib/words/wordsTableAgentWorkflow.client";
import DeleteWordSenseModalButton from "./DeleteWordSenseModalButton.client";
import {
  buildMeaningReviewResultRecord,
  MeaningReviewSingleFlight,
  prepareMeaningReviewFinalization,
  type MeaningReviewCorrection as Correction,
  type MeaningReviewPreviewRecord,
  type MeaningReviewResultRecord,
} from "@/lib/words/meaningReviewFinalization";

const PROMPT_PATHS = [
  "src/prompts/word-extraction/pos/rulseV1.md",
  "src/prompts/word-extraction/concept_explained_fa/rulseV1.md",
  "src/prompts/word-extraction/sentence_en/rulseV1.md",
  "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
  "src/prompts/word-extraction/meaning_fa_review/rulseV1.md",
] as const;
const PROMPT_SOURCE_PATHS = [
  ...PROMPT_PATHS,
  "src/prompts/word-extraction/_shared/meaning_fa_core_v1.md",
  "src/prompts/word-extraction/other_meanings_fa/rulseV1.md",
  "src/prompts/word-extraction/_shared/other_meanings_fa_core_v1.md",
] as const;
const ATTENTION_PROMPT_PATH = "src/prompts/word-extraction/meaning_fa_attention/rulseV1.md";

type AttentionItem = {
  id: number;
  meaningReviewStatus: string;
  pos: string | null;
  concept_explained_fa: string | null;
  english: { base_form: string };
  meaning: { canonical_text: string } | null;
};

type ApplyOutcome = {
  id: number;
  status: "updated" | "review_confirmed" | "already_current" | "attention_required";
};
type ApplyReport = {
  total: number;
  updated: number;
  reviewConfirmed: number;
  unchanged: number;
  attentionRequired: number;
  attentionRequiredIds: number[];
  idempotentReplay: boolean;
  conflictReportId: string | null;
  reportPersistenceWarning?: string;
  results: ApplyOutcome[];
};
type EligibilitySummary = {
  totalEligible: number;
  pendingReview: number;
  excludedMissingMeaning: number;
  needsAction: number;
  missingOtherMeanings: number;
  missingPos: number;
  missingConcept: number;
  missingSentence: number;
  missingSentenceTranslation: number;
};

function meaningReviewChangeSummary(
  current: MeaningReviewPreviewRecord,
  draft: string,
) {
  let result: MeaningReviewResultRecord;
  try {
    result = JSON.parse(draft) as MeaningReviewResultRecord;
  } catch {
    return ["Resulting JSON is invalid."];
  }
  if (!result || typeof result !== "object" || !Array.isArray(result.sentences)) {
    return ["Resulting record is incomplete or invalid."];
  }
  if (result.review_status === "NEEDS_ACTION_INVALID_PRIMARY") {
    return [
      "No content changes",
      `${current.review_status ?? "PENDING"} → NEEDS_ACTION_INVALID_PRIMARY`,
    ];
  }
  const changes: string[] = [];
  if (result.meaning_fa !== current.meaning_fa) changes.push("Primary meaning changed");
  const currentOther = current.other_meanings_fa;
  if (JSON.stringify(result.other_meanings_fa) !== JSON.stringify(currentOther)) {
    const before = new Set(currentOther ?? []);
    const after = new Set(result.other_meanings_fa ?? []);
    const removed = [...before].filter((meaning) => !after.has(meaning));
    const added = [...after].filter((meaning) => !before.has(meaning));
    if (removed.length) changes.push(`Removed alternatives: ${removed.map((value) => `“${value}”`).join(", ")}`);
    if (added.length) changes.push(`Added alternatives: ${added.map((value) => `“${value}”`).join(", ")}`);
    if (!removed.length && !added.length) changes.push("Alternative meanings changed");
  }
  if (result.pos !== current.pos) changes.push(`Part of speech: ${current.pos ?? "null"} → ${result.pos ?? "null"}`);
  if (result.concept_explained_fa !== current.concept_explained_fa) changes.push("Concept explanation changed");
  const currentSentences = new Map((current.sentences ?? []).map((sentence) => [sentence.id, sentence]));
  const resultIds = new Set(result.sentences
    .filter((sentence) => sentence.sentence_id !== null)
    .map((sentence) => sentence.sentence_id as number));
  const removedSentenceIds = [...currentSentences.keys()].filter((id) => !resultIds.has(id));
  if (removedSentenceIds.length) changes.push(`Replaced sentence IDs: ${removedSentenceIds.join(", ")}`);
  if (result.sentences.some((sentence) => sentence.sentence_id === null)) changes.push("One new sentence will be linked");
  const translatedIds = result.sentences.flatMap((sentence) => {
    if (sentence.sentence_id === null) return [];
    return sentence.sentence_en_meaning_fa !== currentSentences.get(sentence.sentence_id)?.sentence_en_meaning_fa
      ? [sentence.sentence_id]
      : [];
  });
  if (translatedIds.length) changes.push(`Updated sentence translations: ${translatedIds.join(", ")}`);
  if (!changes.length) changes.push("No content changes");
  changes.push(`${current.review_status ?? "PENDING"} → CONFIRMED`);
  return changes;
}
export default function WordSenseMeaningsReview({
  pendingCount,
  statusPendingCount,
  initialSummary,
}: {
  pendingCount: number;
  statusPendingCount: number;
  initialSummary: EligibilitySummary;
}) {
  const r = useRouter(),
    [o, setO] = useState(false),
    [l, setL] = useState(String(initialSummary.totalEligible)),
    [d, setD] = useState(""),
    [prompt, setPrompt] = useState(""),
    [a, setA] = useState(""),
    [b, setB] = useState(false),
    [e, setE] = useState<string | null>(null),
    [remaining, setRemaining] = useState<number | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const pendingAgent = usePendingAgentArtifact("review_persian_meanings");
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [summary, setSummary] = useState(initialSummary);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [showCloseHelp, setShowCloseHelp] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmReport, setConfirmReport] = useState<ApplyReport | null>(null);
  const [outcomeById, setOutcomeById] = useState<Record<number, ApplyOutcome["status"]>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportJson, setReportJson] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [attentionPromptRecords, setAttentionPromptRecords] = useState<unknown[]>([]);
  const [attentionPrompt, setAttentionPrompt] = useState("");
  const [attentionCopied, setAttentionCopied] = useState(false);
  const [attentionDrafts, setAttentionDrafts] = useState<Record<number, string>>({});
  const [attentionLoading, setAttentionLoading] = useState(false);
  useEffect(() => setL(String(initialSummary.totalEligible)), [initialSummary.totalEligible]);
  const loadAttention = async () => {
    setAttentionLoading(true);
    setE(null);
    try {
      const [response, promptResponse] = await Promise.all([
        fetch("/api/words/meanings-review/needs-action"),
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent(ATTENTION_PROMPT_PATH)}`),
      ]);
      const json = await response.json() as {
        ok?: boolean;
        items?: AttentionItem[];
        promptRecords?: unknown[];
        error?: string;
      };
      const promptJson = await promptResponse.json() as { text?: string; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not load records needing action.");
      if (!promptResponse.ok || !promptJson.text) {
        throw new Error(promptJson.error || "Could not load the attention analysis prompt.");
      }
      const items = json.items ?? [];
      setAttentionItems(items);
      setAttentionPromptRecords(json.promptRecords ?? []);
      setAttentionPrompt(promptJson.text);
      setAttentionCopied(false);
      setAttentionDrafts(Object.fromEntries(items.map((item) => [item.id, item.meaning?.canonical_text ?? ""])));
      setAttentionOpen(true);
    } catch (error) {
      setE(error instanceof Error ? error.message : String(error));
    } finally {
      setAttentionLoading(false);
    }
  };
  const copyAttentionPrompt = async () => {
    try {
      await navigator.clipboard.writeText(
        `${attentionPrompt}\n\n# Current database snapshot\n\n${JSON.stringify(attentionPromptRecords, null, 2)}`,
      );
      setAttentionCopied(true);
      window.setTimeout(() => setAttentionCopied(false), 1500);
    } catch (error) {
      setE(error instanceof Error ? error.message : String(error));
    }
  };
  const resolveAttention = async (id: number, action: "confirm_current" | "replace_primary") => {
    setAttentionLoading(true);
    setE(null);
    try {
      const response = await fetch("/api/words/meanings-review/needs-action/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, meaning_fa: attentionDrafts[id] }),
      });
      const json = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not resolve this record.");
      setAttentionItems((items) => items.filter((item) => item.id !== id));
      setSummary((current) => ({ ...current, needsAction: Math.max(0, current.needsAction - 1) }));
      r.refresh();
    } catch (error) {
      setE(error instanceof Error ? error.message : String(error));
    } finally {
      setAttentionLoading(false);
    }
  };
  const requestGate = useRef(new MeaningReviewSingleFlight());
  const clearLoadedBatch = () => {
    setD("");
    setA("");
    setLoadedCount(0);
    setConfirmedIds(new Set());
    setDrafts({});
    setConfirmError(null);
    setConfirmReport(null);
    setOutcomeById({});
    setNotice(null);
  };
  const load = async (finalNotice?: string) => {
    setB(true);
    setE(null);
    if (!finalNotice) setNotice(null);
    try {
      const [promptResponses, x] = await Promise.all([
          Promise.all(PROMPT_PATHS.map(async (path) => {
            const response = await fetch(`/api/ai/prompt-file?path=${encodeURIComponent(path)}&render=1`);
            const json = (await response.json()) as { text?: string; error?: string };
            if (!response.ok || !json.text) throw new Error(json.error || `Could not load ${path}.`);
            return json.text;
          })),
          fetch(`/api/words/meanings-review?batchSize=${encodeURIComponent(l)}`),
        ]),
        j = (await x.json()) as {
          ok?: boolean;
          items?: unknown;
          totalEligible?: number;
          totalUnconfirmed?: number;
          summary?: EligibilitySummary;
          error?: string;
        };
      if (!x.ok || !j.ok) throw Error(j.error || "Could not create data.");
      setPrompt(combinePromptParts(promptResponses));
      setD(JSON.stringify(j.items, null, 2));
      setRemaining(
        typeof j.totalEligible === "number" ? j.totalEligible : null,
      );
      if (j.summary) setSummary(j.summary);
      const items = Array.isArray(j.items) ? j.items : [];
      setLoadedCount(items.length);
      setNotice(finalNotice ?? `Data created with ${items.length} record(s) ✓`);
    } catch (x) {
      setE(x instanceof Error ? x.message : String(x));
    } finally {
      setB(false);
    }
  };
  const apply = async (responseValue = a) => {
    setB(true);
    setE(null);
    setNotice(null);
    try {
      const c = JSON.parse(responseValue) as unknown;
      const responseObject = !Array.isArray(c) && c && typeof c === "object"
        ? c as Record<string, unknown>
        : null;
      const reviewedIds = responseObject?.reviewedIds;
      const parsed = responseObject?.results as Correction[];
      if (!Array.isArray(reviewedIds) || !reviewedIds.length ||
          reviewedIds.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) ||
          new Set(reviewedIds).size !== reviewedIds.length ||
          !Array.isArray(parsed)) {
        throw Error("Response must include unique positive reviewedIds and a results array.");
      }
      if (
        parsed.some(
          (item) =>
            !item ||
            typeof item !== "object" ||
            typeof item.id !== "number" ||
            !Number.isSafeInteger(item.id) ||
            item.id <= 0 ||
            item.mode !== "review",
        ) || new Set(parsed.map((item) => item.id)).size !== parsed.length ||
        parsed.some((item) => !reviewedIds.includes(item.id))
      )
        throw Error("Response contains an invalid record.");
      const recordsResponse = await fetch(
        "/api/words/meanings-review/records",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reviewedIds }),
        },
      );
      const recordsJson = (await recordsResponse.json()) as {
        ok?: boolean;
        items?: unknown;
        error?: string;
      };
      if (!recordsResponse.ok || !recordsJson.ok)
        throw Error(recordsJson.error || "Could not rebuild current records from the response IDs.");
      const previewRecords = Array.isArray(recordsJson.items)
        ? recordsJson.items as MeaningReviewPreviewRecord[]
        : [];
      const correctionsById = new Map(parsed.map((item) => [item.id, item]));
      setD(JSON.stringify(previewRecords, null, 2));
      setDrafts(
        Object.fromEntries(
          previewRecords.map((record) => [
            record.id,
            JSON.stringify(buildMeaningReviewResultRecord(record, correctionsById.get(record.id)), null, 2),
          ]),
        ),
      );
      setConfirmedIds(new Set());
      setConfirmError(null);
      setConfirmReport(null);
      setOutcomeById({});
      setConfirmOpen(true);
    } catch (x) {
      setE(x instanceof Error ? x.message : String(x));
    } finally {
      setB(false);
    }
  };
  const commit = async (request: {
    ids: number[];
    results: Correction[];
    requestKey: string;
  }) => {
    if (!requestGate.current.begin()) {
      setConfirmError("This review request is already being processed.");
      return null;
    }
    setB(true);
    setE(null);
    setConfirmError(null);
    try {
      const x = await fetch("/api/words/meanings-review/update-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }),
        j = await x.json() as {
          ok?: boolean;
          error?: string;
          failedId?: number;
          rolledBack?: boolean;
          updated?: number;
          reviewConfirmed?: number;
          unchanged?: number;
          total?: number;
          attentionRequired?: number;
          attentionRequiredIds?: number[];
          idempotentReplay?: boolean;
          conflictReportId?: string | null;
          reportPersistenceWarning?: string;
          results?: ApplyOutcome[];
        };
      if (!x.ok || !j.ok) {
        const failedRecord = j.failedId ? ` WordSense ${j.failedId}:` : "";
        const rollback = j.rolledBack ? " No changes were committed." : "";
        throw Error(`${failedRecord} ${j.error || "Could not apply review."}${rollback}`.trim());
      }
      const report: ApplyReport = {
        total: j.total ?? request.ids.length,
        updated: j.updated ?? 0,
        reviewConfirmed: j.reviewConfirmed ?? 0,
        unchanged: j.unchanged ?? 0,
        attentionRequired: j.attentionRequired ?? 0,
        attentionRequiredIds: j.attentionRequiredIds ?? [],
        idempotentReplay: j.idempotentReplay ?? false,
        conflictReportId: j.conflictReportId ?? null,
        reportPersistenceWarning: j.reportPersistenceWarning,
        results: j.results ?? [],
      };
      setConfirmReport(report);
      setOutcomeById((current) => ({
        ...current,
        ...Object.fromEntries(report.results.map((outcome) => [outcome.id, outcome.status])),
      }));
      r.refresh();
      setConfirmedIds((current) => new Set([...current, ...request.ids]));
      if (request.ids.length > 1) setA("");
      return report;
    } catch (x) {
      setConfirmError(x instanceof Error ? x.message : String(x));
      return null;
    } finally {
      requestGate.current.end();
      setB(false);
    }
  };
  const reportText = (report: ApplyReport) => [
    `Processed ${report.total} ✓`,
    `Content updated: ${report.updated}`,
    `Reviewed only: ${report.reviewConfirmed}`,
    `Already current: ${report.unchanged}`,
    `Moved to Needs Your Action: ${report.attentionRequired}`,
    `Attention required: ${report.attentionRequired}`,
    ...(report.idempotentReplay ? ["Idempotent replay: no duplicate changes"] : []),
  ].join(" • ");
  const showConflictReports = async () => {
    setReportLoading(true);
    setE(null);
    try {
      const response = await fetch("/api/words/meanings-review/conflict-reports");
      const json = await response.json() as { ok?: boolean; reports?: unknown; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not load JSON reports.");
      setReportJson(JSON.stringify(json.reports ?? [], null, 2));
      setReportOpen(true);
    } catch (error) {
      setE(error instanceof Error ? error.message : String(error));
    } finally {
      setReportLoading(false);
    }
  };
  const closeAndConfirm = async () => {
    try {
      const request = prepareMeaningReviewFinalization({
        previewRecords: (d ? JSON.parse(d) : []) as MeaningReviewPreviewRecord[],
        drafts,
        confirmedIds,
      });
      const report = await commit(request);
      if (report) {
        const finalNotice = reportText(report);
        if (agentRunId) {
          await completeAgentArtifact(agentRunId);
          setAgentRunId(null);
          await pendingAgent.refresh();
        }
        setNotice(finalNotice);
        setConfirmOpen(false);
        await load(finalNotice);
      }
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : String(error));
    }
  };
  const confirmOne = async (id: number) => {
    try {
      const previewRecords = (d ? JSON.parse(d) : []) as MeaningReviewPreviewRecord[];
      const record = previewRecords.find((item) => item.id === id);
      if (!record) throw new Error(`WordSense ${id} is not available in this preview.`);
      const request = prepareMeaningReviewFinalization({
        previewRecords: [record],
        drafts,
        confirmedIds: new Set(),
      });
      await commit(request);
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : String(error));
    }
  };
  const copyAll = () =>
    void navigator.clipboard
      .writeText(`${prompt}\n\n${d}`)
      .then(() => setNotice("Prompt and data copied ✓"))
      .catch((reason) =>
        setE(reason instanceof Error ? reason.message : String(reason)),
      );
  const openStage = async () => {
    setB(true);
    setE(null);
    try {
      const artifact = await pendingAgent.loadResponse();
      if (!artifact || artifact.response === undefined) {
        setO(true);
        await load();
        return;
      }
      const savedResponse = JSON.stringify(artifact.response, null, 2);
      setA(savedResponse);
      setAgentRunId(artifact.runId);
      setO(true);
      await apply(savedResponse);
    } catch (error) {
      setE(error instanceof Error ? error.message : String(error));
    } finally {
      setB(false);
    }
  };
  return (
    <>
      <div className="inline-flex items-start gap-1">
        <button
          type="button"
          onClick={() => void openStage()}
          disabled={b}
          className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          1. REVIEW PERSIAN MEANINGS <RemainingCountBadge count={pendingCount} />
          {pendingAgent.artifact ? <span className="ml-1 text-emerald-700">AI response ready ✓</span> : null}
        </button>
        <button
          type="button"
          onClick={() => void loadAttention()}
          disabled={attentionLoading}
          className="rounded border border-amber-500 px-3 py-2 text-sm text-amber-800 transition active:scale-90 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
        >
          NEEDS YOUR ACTION <RemainingCountBadge count={summary.needsAction} />
        </button>
        <BulkReviewStatusActions
          pendingCount={statusPendingCount}
          pendingUnit="رکورد در انتظار"
          confirmEndpoint="/api/words/meanings-review/confirm-all"
          resetEndpoint="/api/words/meanings-review/reset-confirmed"
          confirmSubject="معانی فارسی"
          confirmWarning="این کار فقط رکوردهای دارای معنی و شش بخش کامل را تأیید می‌کند. رکورد ناقص یا فاقد معنی تغییر نمی‌کند و هیچ مقدار محتوایی ویرایش نمی‌شود."
          resetSubject="مرورهای معانی فارسی"
          resetWarning="تمام رکوردهای تأییدشده دوباره Pending می‌شوند. هیچ معنا، دیگرمعنا یا جمله‌ای تغییر نمی‌کند."
          resetHelpLabel="About reset meanings review"
          resetHelpText="Sets all reviewed Persian meanings back to pending. Confirmation is required."
        />
      </div>
      {attentionOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => event.target === event.currentTarget && !attentionLoading && setAttentionOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-2xl border border-card bg-background p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Meaning review — needs your action</b>
                <p dir="rtl" className="mt-1 text-right text-sm opacity-70">این رکوردها از Remaining خارج شده‌اند و دوباره برای AI ارسال نمی‌شوند. معنی را اصلاح و تأیید کنید، معنی فعلی را نگه دارید، یا کل WordSense را حذف کنید.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <PromptSourcesButton paths={[ATTENTION_PROMPT_PATH]} label="ATTENTION PROMPT FILE" />
                <button
                  type="button"
                  disabled={attentionLoading || !attentionPrompt || !attentionPromptRecords.length}
                  onClick={() => void copyAttentionPrompt()}
                  className="rounded border border-amber-500 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50 dark:text-amber-300"
                >
                  {attentionCopied ? "COPIED ✓" : `COPY ATTENTION PROMPT (${attentionPromptRecords.length})`}
                </button>
                <button type="button" disabled={attentionLoading} onClick={() => setAttentionOpen(false)} className="rounded border px-3 py-2 text-sm">Close</button>
              </div>
            </div>
            <p dir="rtl" className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-right text-sm">
              دکمهٔ Copy، دستور تحلیل و snapshot فعلی دیتابیس را با هم کپی می‌کند. مدل باید علت ثبت‌شده را از تشخیص احتمالی جدا کند و برای هر رکورد اقدام پیشنهادی بدهد؛ هیچ تغییری مستقیماً اعمال نمی‌شود.
            </p>
            {e ? <div className="mt-3 rounded border border-red-500/30 bg-red-500/10 p-2 text-red-700">{e}</div> : null}
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-auto">
              {attentionItems.length ? attentionItems.map((item) => {
                const missing = item.meaningReviewStatus === "NEEDS_ACTION_MISSING_PRIMARY";
                return (
                  <section key={item.id} className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><b>#{item.id} — {item.english.base_form}</b><div className="text-xs text-amber-700">{item.meaningReviewStatus}</div></div>
                      <DeleteWordSenseModalButton id={item.id} label={item.english.base_form} onDeleted={(id) => {
                        setAttentionItems((items) => items.filter((entry) => entry.id !== id));
                        setSummary((current) => ({ ...current, needsAction: Math.max(0, current.needsAction - 1) }));
                      }} />
                    </div>
                    <label className="mt-3 block text-sm">
                      <span>Primary Persian meaning</span>
                      <input dir="rtl" value={attentionDrafts[item.id] ?? ""} onChange={(event) => setAttentionDrafts((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-1 w-full rounded border bg-transparent px-3 py-2 text-right" placeholder="معنی فارسی را وارد کنید" />
                    </label>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {!missing && item.meaning?.canonical_text ? <button type="button" disabled={attentionLoading} onClick={() => void resolveAttention(item.id, "confirm_current")} className="rounded border px-3 py-2 text-sm">Keep current &amp; confirm</button> : null}
                      <button type="button" disabled={attentionLoading || !(attentionDrafts[item.id] ?? "").trim()} onClick={() => void resolveAttention(item.id, "replace_primary")} className="rounded border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50">{missing ? "Add & confirm" : "Save & confirm"}</button>
                    </div>
                  </section>
                );
              }) : <div dir="rtl" className="rounded border p-6 text-center">هیچ رکوردی نیازمند اقدام نیست.</div>}
            </div>
          </div>
        </div>
      ) : null}
      {o ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !b && setO(false)
          }
        >
          <div className="flex h-[85vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Persian meanings review — WordSense</b>
                <div className="text-xs opacity-70">
                  Reviews and completes the six core WordSense fields in staged mode.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={reportLoading}
                  onClick={() => void showConflictReports()}
                  className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  <span dir="rtl">نمایش گزارش JSON موارد کنارگذاشته‌شده</span>
                </button>
                <button
                  type="button"
                  aria-expanded={showWorkflowGuide}
                  aria-controls="word-meaning-review-workflow-guide"
                  onClick={() => setShowWorkflowGuide((current) => !current)}
                  className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  راهنمای انتخاب و تغییر داده‌ها
                </button>
                <button
                  type="button"
                  disabled={b}
                  onClick={() => setO(false)}
                  className="rounded border px-2 py-1 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>
            {showWorkflowGuide ? (
              <div
                id="word-meaning-review-workflow-guide"
                dir="rtl"
                className="max-h-64 overflow-auto rounded border border-blue-500/30 bg-blue-500/10 p-3 text-right text-sm leading-6"
              >
                <div className="font-semibold">هدف این مرحله</div>
                <p>
                  <code>meaning_fa</code> معنی مرجع و ثابت WordSense است. concept،
                  معانی دیگر، نقش دستوری، جمله و ترجمه با همین معنی هماهنگ و در
                  صورت نیاز تکمیل یا اصلاح می‌شوند.
                </p>
                <div className="mt-2 font-semibold">شرایط انتخاب رکوردها</div>
                <ul className="list-disc pr-5">
                  <li>فقط WordSense دارای معنی اصلی وارد این workflow می‌شود.</li>
                  <li>رکورد بدون معنی برای data entry آینده کنار گذاشته می‌شود و مدل برای آن معنی حدس نمی‌زند.</li>
                  <li>فقط رکورد دارای <code>meaningReviewStatus=PENDING</code> وارد صف AI می‌شود.</li>
                  <li><code>otherMeaningIds=null</code> یعنی هنوز تعیین نشده و ناقص است؛ <code>[]</code> یعنی بررسی شده ولی معادل جایگزین مفیدی وجود ندارد.</li>
                  <li>Count تعداد رکوردهایی را تعیین می‌کند که در دادهٔ پرامپت قرار می‌گیرند.</li>
                  <li>همهٔ جمله‌های موجود در آرایهٔ <code>sentenceIds</code> برای بررسی به مدل نشان داده می‌شوند.</li>
                </ul>
                <div className="mt-2 font-semibold">اولویت قطعی معنی و concept</div>
                <ul className="list-disc pr-5">
                  <li><code>meaning_fa</code> ابتدا طبق قواعد مشترک بررسی می‌شود؛ مقدار معتبر یا اصلاح‌شدهٔ بدون تغییر sense، هویت معنایی و مرجع اصلی است.</li>
                  <li>اگر concept خالی یا ناسازگار است، براساس معنی اصلاح یا تولید می‌شود.</li>
                  <li>معنی بدون تغییر sense برای ایراد سطحی یا جزئیاتی که فقط از کلمات دیگر جمله وارد شده‌اند اصلاح می‌شود؛ تغییر sense ممنوع است.</li>
                  <li>اگر معنی متعلق به <code>base_form</code> نیست، اصلاح به تغییر sense نیاز دارد، یا حفظ همان sense قطعی نیست، مدل فقط <code>invalid_primary_meaning=true</code> گزارش می‌کند؛ هیچ داده‌ای تغییر نمی‌کند و رکورد برای رسیدگی یا حذف دستی pending می‌ماند.</li>
                </ul>
                <div className="mt-2 font-semibold">هماهنگ‌سازی فیلدهای وابسته</div>
                <ul className="list-disc pr-5">
                  <li>معانی دیگر فقط معادل‌های طبیعی همان sense هستند و معانی متعلق به sense دیگر کنار گذاشته می‌شوند.</li>
                  <li><code>pos</code> از معنی و concept نهایی تشخیص داده و در صورت نیاز اصلاح می‌شود.</li>
                  <li>اگر جمله با معنی و concept هماهنگ است ولی <code>pos</code> ذخیره‌شده اشتباه است، جمله حفظ و فقط <code>pos</code> اصلاح می‌شود.</li>
                  <li>اگر جمله sense یا نقش دیگری دارد، از این WordSense جدا و دقیقاً یک جملهٔ جایگزین همراه ترجمه تولید می‌شود.</li>
                  <li>جملهٔ طبیعی و هماهنگ صرفاً برای بهتر یا متفاوت‌کردن متن عوض نمی‌شود.</li>
                </ul>
                <div className="mt-2 font-semibold">چه چیزهایی ساخته یا تغییر داده می‌شوند؟</div>
                <ul className="list-disc pr-5">
                  <li>concept، معانی دیگر، <code>pos</code>، جمله و ترجمه فقط در صورت نیاز ذخیره یا اصلاح می‌شوند.</li>
                  <li>برای معنی فارسی جدید، PersianWord موجود reuse می‌شود و فقط اگر وجود نداشته باشد PersianWord جدید ساخته می‌شود.</li>
                  <li>برای جملهٔ جدید نیز Sentence موجود reuse می‌شود و فقط اگر متن آن وجود نداشته باشد Sentence جدید همراه ترجمه ساخته و به WordSense متصل می‌شود.</li>
                  <li>ترجمهٔ خالی Sentence موجود می‌تواند تکمیل شود و ID جملهٔ نامعتبر فقط از <code>sentenceIds</code> این WordSense خارج می‌شود.</li>
                  <li>اگر جملهٔ اصلی نامعتبر باشد، جملهٔ جایگزین در جایگاه آن قرار می‌گیرد تا <code>sentenceIds[0]</code> همچنان جملهٔ اصلی باشد.</li>
                </ul>
                <div className="mt-2 font-semibold">پایان فرایند و جلوگیری از حلقه</div>
                <ul className="list-disc pr-5">
                  <li>برای Paste و اعمال پاسخ، اجرای دوبارهٔ <code>Create data</code> لازم نیست؛ رکوردهای فعلی مستقیماً از روی <code>reviewedIds</code> خوانده می‌شوند.</li>
                  <li>مقدار یکسان دوباره نوشته نمی‌شود؛ مقدار متفاوت اعمال می‌شود و نتیجهٔ بدون نیاز به تغییر نیز در گزارش مشخص است.</li>
                  <li>رکورد معتبر در همان review کامل می‌شود و وضعیت <code>CONFIRMED</code> می‌گیرد؛ بنابراین از صف خارج می‌شود.</li>
                  <li>برای هر WordSense در هر اجرا حداکثر یک جملهٔ جدید پذیرفته می‌شود و جملهٔ تازه در همان اجرا دوباره بررسی یا تکثیر نمی‌شود.</li>
                  <li>گزارش معنی نامعتبر از صف AI خارج می‌شود و در «Needs Your Action» برای اصلاح، تأیید یا حذف دستی قرار می‌گیرد.</li>
                  <li>اگر ساخت PersianWord به‌علت چند رکورد با normalized_text یکسان مبهم باشد، گزارش JSON حفظ می‌شود و WordSense بدون حذف وارد «Needs Your Action» می‌شود.</li>
                  <li>Sentence، EnglishWord و PersianWordهای مرتبط در این حالت حذف نمی‌شوند و هیچ WordSense جدیدی نیز در این مرحله ساخته نمی‌شود.</li>
                  <li>این مرحله WordSenseهای تکراری را ادغام یا حذف نمی‌کند؛ آن کار متعلق به workflowهای merge است.</li>
                </ul>
              </div>
            ) : null}
            {e ? <div className="text-red-600">{e}</div> : null}
            {notice ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">
                {notice}
              </div>
            ) : null}
            {!confirmOpen && confirmReport ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-900">
                <div>
                  Updated ids: {confirmReport.results.filter((item) => item.status === "updated").map((item) => item.id).join(", ") || "none"}
                </div>
                <div>
                  Reviewed-only ids: {confirmReport.results.filter((item) => item.status === "review_confirmed").map((item) => item.id).join(", ") || "none"}
                </div>
                <div>
                  Already-current ids: {confirmReport.results.filter((item) => item.status === "already_current").map((item) => item.id).join(", ") || "none"}
                </div>
                <div>
                  Attention-required ids: {confirmReport.attentionRequiredIds.join(", ") || "none"}
                </div>
                <div>
                  JSON-reported normalization conflicts moved to Needs Your Action; no WordSense was auto-deleted.
                </div>
                {confirmReport.conflictReportId ? (
                  <div>Conflict report: {confirmReport.conflictReportId}</div>
                ) : null}
              </div>
            ) : null}
            <div dir="rtl" className="flex flex-wrap gap-2 text-right text-xs">
              <span className="rounded-full border px-2 py-1">کل واجد شرایط: {summary.totalEligible.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">مرور معنی: {summary.pendingReview.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">فاقد معنی و خارج فرایند: {summary.excludedMissingMeaning.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">معانی دیگر ناقص: {summary.missingOtherMeanings.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">نقش ناقص: {summary.missingPos.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">concept ناقص: {summary.missingConcept.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">جمله ناقص: {summary.missingSentence.toLocaleString()}</span>
              <span className="rounded-full border px-2 py-1">ترجمه ناقص: {summary.missingSentenceTranslation.toLocaleString()}</span>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <PromptBatchControls
                    batchSize={l}
                    disabled={b}
                    loadedCount={loadedCount}
                    totalEligibleCount={remaining}
                    onBatchSizeChange={(value) => { clearLoadedBatch(); setL(value); }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={b}
                    className="rounded border px-2 py-1 text-xs transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    {b ? "Loading…" : "Create data"}
                  </button>
                  <PromptSourcesButton paths={PROMPT_SOURCE_PATHS} />
                  <button
                    type="button"
                    onClick={copyAll}
                    disabled={b || !d}
                    className="rounded border px-2 py-1 text-xs transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    Copy prompt + data
                  </button>
                  {remaining !== null ? (
                    <RemainingCountButton
                      count={remaining}
                      disabled={b}
                      onClick={() => setL(String(remaining))}
                    />
                  ) : null}
                  </div>
                </div>
                <textarea
                  readOnly
                  value={`${prompt}\n\n${d}`}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                />
              </section>
              <section className="flex min-h-0 flex-col gap-2">
                <b>Response JSON</b>
                <div dir="rtl" className="text-right text-xs opacity-70">
                  پاسخ را می‌توان بدون اجرای دوبارهٔ Create data اعمال کرد؛ رکوردها از روی reviewedIds خوانده می‌شوند.
                </div>
                <textarea
                  value={a}
                  disabled={b}
                  onChange={(x) => setA(x.target.value)}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                  placeholder='{"reviewedIds":[1],"results":[{"id":1,"mode":"review","pos":"noun"}]}'
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={b}
                    onClick={() =>
                      void navigator.clipboard
                        .readText()
                        .then(setA)
                        .catch((reason) =>
                          setE(
                            reason instanceof Error
                              ? reason.message
                              : String(reason),
                          ),
                        )
                    }
                    className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    Paste response
                  </button>
                  <button
                    type="button"
                    onClick={() => void apply()}
                    disabled={b || !a.trim()}
                    className="flex-1 rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    {b ? "Updating…" : "APPLY REVIEW"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meaning-review-confirm-title"
        >
          <div className="flex h-[85vh] w-full max-w-6xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex justify-between">
              <div>
                <b id="meaning-review-confirm-title">Confirm meaning updates</b>
                <div className="text-xs opacity-70">
                  Every reviewed ID is shown. Edit the complete resulting record, then compare the
                  human-readable change summary before confirming. The API still receives only the validated patch.
                </div>
              </div>
              <div className="relative flex gap-2">
                <button
                  type="button"
                  disabled={b}
                  onClick={() => setConfirmOpen(false)}
                  className="rounded border px-2 py-1 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  Close without saving
                </button>
                <button
                  type="button"
                  disabled={b}
                  onClick={() => void closeAndConfirm()}
                  className="rounded border px-2 py-1 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50"
                >
                  {b ? "PROCESSING…" : "MARK ALL AS REVIEWED AND CLOSE"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseHelp((current) => !current)}
                  aria-label="About mark all as reviewed"
                  title="About mark all as reviewed"
                  className="rounded border p-1.5 transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <ActionIcon name="help" />
                </button>
                {showCloseHelp ? (
                  <div
                    dir="rtl"
                    className="absolute right-0 top-full z-10 mt-2 w-72 rounded border bg-background p-3 text-right text-xs shadow-elevated"
                  >
                    این دکمه تمام تغییرات پیشنهادی را در یک تراکنش دیتابیس اعمال می‌کند،
                    رکوردهای کامل را مرورشده ثبت می‌کند و سپس پنجره را می‌بندد.
                    خطای ابهام normalized_text ابتدا در فایل JSON گزارش می‌شود و
                    WordSense مربوط بدون حذف وارد Needs Your Action می‌شود.
                    گزارش‌های معنی نامعتبر نیز از صف AI خارج و وارد همان بخش می‌شوند.
                  </div>
                ) : null}
              </div>
            </div>
            {confirmError ? (
              <div
                role="alert"
                className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700"
              >
                <strong>Nothing was committed.</strong> {confirmError}
              </div>
            ) : null}
            {confirmReport ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">
                <div>{reportText(confirmReport)}</div>
                {confirmReport.attentionRequiredIds.length ? (
                  <div className="mt-1">
                    Invalid primary meaning / attention required: {confirmReport.attentionRequiredIds.join(", ")}
                  </div>
                ) : null}
                {confirmReport.reportPersistenceWarning ? (
                  <div className="mt-1 text-amber-800">{confirmReport.reportPersistenceWarning}</div>
                ) : null}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto rounded border">
              <table className="w-full min-w-[1100px] table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[29%]" />
                  <col className="w-[38%]" />
                  <col className="w-[20%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-3 py-2">id</th>
                    <th className="px-3 py-2">Current record</th>
                    <th className="px-3 py-2">Result after apply (editable)</th>
                    <th className="px-3 py-2">What will change</th>
                    <th className="px-3 py-2">action</th>
                  </tr>
                </thead>
                <tbody>
                  {((d ? JSON.parse(d) : []) as MeaningReviewPreviewRecord[]).map((record) => {
                    const draft = drafts[record.id] ?? "";
                    const currentRecord = {
                      ...buildMeaningReviewResultRecord(record),
                      review_status: record.review_status ?? "PENDING",
                    };
                    const changes = meaningReviewChangeSummary(record, draft);
                    return (
                      <tr
                        key={record.id}
                        className={`border-b align-top ${confirmedIds.has(record.id) ? "bg-emerald-500/10" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono">{record.id}</td>
                        <td className="px-3 py-2">
                          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded bg-black/[0.03] p-3 font-mono dark:bg-white/[0.04]">
                            {JSON.stringify(currentRecord, null, 2)}
                          </pre>
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            value={draft}
                            rows={Math.max(20, Math.min(36, draft.split("\n").length + 1))}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [record.id]: event.target.value,
                              }))
                            }
                            disabled={b}
                            className="min-h-[24rem] w-full resize-y rounded border p-3 font-mono disabled:opacity-50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <ul className="space-y-2">
                            {changes.map((change) => (
                              <li
                                key={change}
                                className={`rounded border px-2 py-1.5 leading-relaxed ${
                                  change.startsWith("Removed") || change.startsWith("Replaced")
                                    ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200"
                                    : change.startsWith("Added") || change.startsWith("One new")
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                                      : "border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
                                }`}
                              >
                                {change}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={b}
                            onClick={() => void confirmOne(record.id)}
                            className="rounded border px-2 py-1 transition active:scale-90 hover:bg-black/5 disabled:opacity-50"
                          >
                            {outcomeById[record.id] === "attention_required"
                              ? "Attention required"
                              : confirmedIds.has(record.id)
                                ? "Confirmed ✓"
                                : "Confirm"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      {reportOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meaning-review-conflict-reports-title"
        >
          <div className="flex h-[85vh] w-full max-w-6xl flex-col gap-3 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b id="meaning-review-conflict-reports-title">Meaning review conflict reports — JSON</b>
                <div dir="rtl" className="mt-1 text-right text-xs opacity-70">
                  این داده‌ها از فایل‌های ماندگار داخل پوشه backups خوانده می‌شوند و شامل snapshot، پیشنهاد، علت ابهام و شناسهٔ WordSense حذف‌شده هستند.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(reportJson)}
                  className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>
            <textarea readOnly value={reportJson} className="min-h-0 flex-1 rounded border p-3 font-mono text-xs" />
          </div>
        </div>
      ) : null}
    </>
  );
}
