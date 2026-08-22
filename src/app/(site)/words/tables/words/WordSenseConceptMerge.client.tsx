"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/icons/ActionIcon";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { PromptBatchControls } from "@/components/prompts/PromptBatchControls.client";
import { RemainingCountButton, RemainingGroupRecordBadge } from "@/components/remaining-count";
import { BulkReviewStatusActions } from "@/components/review-status/BulkReviewStatusActions.client";
import { PersianWordResolutionModal } from "@/components/words/PersianWordResolutionModal.client";
import type {
  PersianWordAmbiguity,
  PersianWordResolutionSelection,
} from "@/lib/words/persianWordResolution";
import { completeAgentArtifact, usePendingAgentArtifact } from "@/lib/words/wordsTableAgentWorkflow.client";

const PROMPT_PATH = "src/prompts/word-extraction/merge_word_concepts/rulseV1.md";
const MANUAL_PROMPT_PATH = "src/prompts/word-extraction/manual_merge_word_concepts/rulseV1.md";
const PROMPT_SOURCE_PATHS = [
  PROMPT_PATH,
  "src/prompts/word-extraction/_shared/other_meanings_fa_core_v1.md",
] as const;
const MANUAL_PROMPT_SOURCE_PATHS = [MANUAL_PROMPT_PATH] as const;

type SourceRow = {
  id: number;
  word: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string;
  pos: string;
  sentenceIds: number[];
  sentences: Array<{
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
  }>;
};

type RetainedOutputRow = {
  id: number;
  word: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string;
  sentenceIds: number[];
  delete: false;
  mergedRecordIds: number[];
  mergedIntoId: null;
};

type OutputRow = RetainedOutputRow | { id: number; delete: true; mergedIntoId: number };
type PreviewDecision = "approve" | "reject" | "defer";
type RetainedChangedField = "meaning_fa" | "other_meanings_fa" | "concept_explained_fa" | "sentenceIds";

type PreviewUnit = {
  key: string;
  kind: "merge" | "update" | "unchanged";
  recordIds: number[];
  sourceRows: SourceRow[];
  outputRows: OutputRow[];
};

type SentenceModalState = { title: string; ids: number[] };

type PrepareResponse = {
  ok?: boolean;
  items?: SourceRow[][];
  sourceGroups?: number[][];
  totalEligibleGroups?: number;
  reviewedSingleRecords?: number;
  error?: string;
};

type ManualIdEntry = {
  key: number;
  wordSenseId: string;
};

type ManualGroupState = {
  key: number;
  entries: ManualIdEntry[];
  englishWordId: number | null;
  sourceRows: SourceRow[];
  response: string;
  output: OutputRow[];
  status: "draft" | "ready" | "preview" | "applied";
  busy: boolean;
  error: string | null;
  notice: string | null;
  resolutionAmbiguities: PersianWordAmbiguity[];
};

const buttonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

function sameOrderedValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function retainedChangedFields(current: SourceRow, proposed: RetainedOutputRow): RetainedChangedField[] {
  return [
    ...(current.meaning_fa !== proposed.meaning_fa ? ["meaning_fa" as const] : []),
    ...(!sameOrderedValues(current.other_meanings_fa, proposed.other_meanings_fa) ? ["other_meanings_fa" as const] : []),
    ...(current.concept_explained_fa !== proposed.concept_explained_fa ? ["concept_explained_fa" as const] : []),
    ...(!sameOrderedValues(current.sentenceIds, proposed.sentenceIds) ? ["sentenceIds" as const] : []),
  ];
}

function retainedRowChanged(current: SourceRow | undefined, proposed: RetainedOutputRow) {
  if (!current) return true;
  return proposed.mergedRecordIds.length > 0 ||
    current.word !== proposed.word ||
    retainedChangedFields(current, proposed).length > 0;
}

function SentenceList({
  ids,
  sentenceById,
  addedIds = [],
  removedIds = [],
}: {
  ids: number[];
  sentenceById: Map<number, SourceRow["sentences"][number]>;
  addedIds?: number[];
  removedIds?: number[];
}) {
  if (!ids.length) {
    return (
      <div dir="rtl" className="rounded-md border-2 border-black/40 bg-background p-2 text-right text-sm opacity-60 dark:border-white/40">
        بدون جمله
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {ids.map((id) => {
        const sentence = sentenceById.get(id);
        const added = addedIds.includes(id);
        const removed = removedIds.includes(id);
        return (
          <div
            key={id}
            className={`rounded-md border-2 px-2.5 py-2 ${added ? "border-emerald-600/70 bg-emerald-500/10" : removed ? "border-red-600/70 bg-red-500/10" : "border-black/40 bg-background dark:border-white/40"}`}
          >
            <div className="flex items-start gap-2">
              <span className="shrink-0 font-mono font-semibold">#{id}</span>
              {removed ? <span dir="rtl" className="shrink-0 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 dark:text-red-200">حذف‌شده</span> : null}
              <span dir="ltr" className="text-left">{sentence?.sentence_en ?? "Sentence text not loaded"}</span>
            </div>
            {sentence?.sentence_en_meaning_fa ? (
              <div dir="rtl" className="mt-1 border-t border-black/15 pt-1 text-right dark:border-white/15">
                {sentence.sentence_en_meaning_fa}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PreviewRecordCard({
  row,
  current,
  onOpenJson,
  onOpenSentences,
  onEditConcept,
  embedded = false,
}: {
  row: OutputRow;
  current: SourceRow | undefined;
  onOpenJson: () => void;
  onOpenSentences: (ids: number[], title: string) => void;
  onEditConcept?: () => void;
  embedded?: boolean;
}) {
  const changedFields = !row.delete && current ? retainedChangedFields(current, row) : [];
  const comparison = changedFields.length && !row.delete ? (
    <div className="grid gap-3 p-3 md:grid-cols-2">
      {(["current", "proposed"] as const).map((side) => (
        <div key={side} dir="rtl" className={`grid content-start gap-2 rounded-lg border-2 p-3 text-right ${side === "current" ? "border-red-700/65 bg-red-500/10 dark:border-red-400/65" : "border-emerald-700/65 bg-emerald-500/10 dark:border-emerald-400/65"}`}>
          {changedFields.map((field) => {
            const retainedRow = row;
            if (field === "sentenceIds") {
              const ids = side === "current" ? current?.sentenceIds ?? [] : retainedRow.sentenceIds;
              return (
                <button key={field} type="button" onClick={() => onOpenSentences(ids, side === "current" ? `جملات فعلی WordSense #${row.id}` : `جملات نهایی WordSense #${row.id}`)} className="justify-self-start rounded-md border-2 border-black/35 bg-background px-2.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-black/[0.05] dark:border-white/35 dark:hover:bg-white/[0.06]">
                  نمایش جملات ({ids.length.toLocaleString("fa-IR")})
                </button>
              );
            }
            const value = field === "meaning_fa"
              ? side === "current" ? current?.meaning_fa ?? "" : retainedRow.meaning_fa
              : field === "other_meanings_fa"
                ? (side === "current" ? current?.other_meanings_fa ?? [] : retainedRow.other_meanings_fa).join("، ") || "----"
                : side === "current" ? current?.concept_explained_fa ?? "" : retainedRow.concept_explained_fa;
            const label = field === "meaning_fa" ? "معنی اصلی" : field === "other_meanings_fa" ? "معنی‌های دیگر" : "توضیح مفهوم";
            return (
              <p key={field} className="whitespace-pre-wrap text-sm leading-5">
                <strong className="text-xs">{label}: </strong>
                <span>{value || "—"}</span>
                {field === "concept_explained_fa" && side === "proposed" && onEditConcept ? (
                  <button type="button" onClick={onEditConcept} aria-label="ویرایش توضیح مفهوم پیشنهادی" title="ویرایش توضیح مفهوم پیشنهادی" className="mr-1 inline-flex cursor-pointer rounded border border-black/30 bg-background p-1 align-middle transition hover:bg-black/[0.06] dark:border-white/30 dark:hover:bg-white/[0.06]">
                    <ActionIcon name="edit" className="size-3.5" />
                  </button>
                ) : null}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  ) : null;

  if (embedded) return comparison;

  return (
    <article className="overflow-hidden rounded-lg border-2 border-black/50 bg-background shadow-[0_2px_5px_rgba(0,0,0,0.10)] dark:border-white/45">
      <div className={`flex flex-wrap items-center justify-between gap-2 bg-black/[0.05] px-3 py-2.5 dark:bg-white/[0.05] ${changedFields.length ? "border-b-2 border-black/45 dark:border-white/40" : ""}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" dir="ltr" onClick={onOpenJson} title={`نمایش JSON رکورد ${row.id}`} aria-label={`نمایش JSON رکورد ${row.id}`} className="inline-flex cursor-pointer items-center overflow-hidden rounded-md border-2 border-black/45 bg-background text-xs font-semibold shadow-sm transition hover:bg-black/[0.05] dark:border-white/40 dark:hover:bg-white/[0.06]">
            <span className="px-2 py-1 font-mono">#{row.id}</span>
            <span className="border-l-2 border-black/35 px-2 py-1 font-black dark:border-white/35">J</span>
          </button>
          <span dir="ltr" className="font-semibold">{current?.word ?? (!row.delete ? row.word : "Unknown")}</span>
          <span dir="rtl" className="text-sm">
            <strong>معنی اصلی:</strong> {current?.meaning_fa || "—"}
          </span>
        </div>
        {!changedFields.length ? <span className="text-xs text-muted">KEEP UNCHANGED</span> : null}
      </div>

      {comparison}

    </article>
  );
}

function MergeSourceCard({
  row,
  current,
  retained,
  onOpenJson,
}: {
  row: OutputRow;
  current: SourceRow | undefined;
  retained: boolean;
  onOpenJson: () => void;
}) {
  const meanings = current?.other_meanings_fa ?? [];
  return (
    <article className={`h-full overflow-hidden rounded-lg border-2 shadow-[0_2px_5px_rgba(0,0,0,0.10)] ${retained ? "border-emerald-700/70 bg-emerald-500/10 dark:border-emerald-400/70" : "border-red-700/70 bg-red-500/10 dark:border-red-400/70"}`}>
      <div className="flex items-center justify-between gap-2 border-b-2 border-black/35 px-3 py-2 dark:border-white/35">
        <button
          type="button"
          dir="ltr"
          onClick={onOpenJson}
          title={`نمایش JSON رکورد ${row.id}`}
          aria-label={`نمایش JSON رکورد ${row.id}`}
          className="inline-flex cursor-pointer items-center overflow-hidden rounded-md border-2 border-black/45 bg-background text-xs font-semibold shadow-sm transition hover:bg-black/[0.05] dark:border-white/40 dark:hover:bg-white/[0.06]"
        >
          <span className="px-2 py-1 font-mono">#{row.id}</span>
          <span className="border-l-2 border-black/35 px-2 py-1 font-black dark:border-white/35">J</span>
        </button>
        {!retained ? (
          <span dir="rtl" title="این رکورد پس از ادغام حذف می‌شود" className="inline-flex items-center gap-1 text-red-800 dark:text-red-200">
            <ActionIcon name="trash" className="size-4" />
            <span className="sr-only">این رکورد حذف می‌شود</span>
          </span>
        ) : null}
      </div>
      <div dir="rtl" className="grid gap-2 p-3 text-right">
        <p className="break-words whitespace-pre-wrap text-sm leading-5">
          <strong className="text-xs">معنی اصلی: </strong>
          <span>{current?.meaning_fa || "—"}</span>
        </p>
        <p className="break-words whitespace-pre-wrap text-sm leading-5">
          <strong className="text-xs">معنی‌های دیگر: </strong>
          <span>{meanings.length ? meanings.join("، ") : "----"}</span>
        </p>
        <p className="break-words whitespace-pre-wrap text-sm leading-5">
          <strong className="text-xs">توضیح مفهوم: </strong>
          <span>{current?.concept_explained_fa || "—"}</span>
        </p>
      </div>
    </article>
  );
}

function MergeResultCard({
  proposed,
  onOpenSentences,
  onEditConcept,
}: {
  proposed: RetainedOutputRow;
  onOpenSentences: () => void;
  onEditConcept: () => void;
}) {
  return (
    <article className="h-full overflow-hidden rounded-lg border-2 border-emerald-800/75 bg-emerald-500/15 shadow-[0_2px_6px_rgba(0,0,0,0.12)] dark:border-emerald-300/75">
      <div dir="rtl" className="border-b-2 border-emerald-800/45 px-3 py-2 text-right font-semibold dark:border-emerald-300/45">
        نتیجهٔ نهایی تغییرات
      </div>
      <div dir="rtl" className="grid gap-2 p-3 text-right">
        <p className="break-words whitespace-pre-wrap text-sm leading-5">
          <strong className="text-xs">معنی‌های دیگر: </strong>
          <span>{proposed.other_meanings_fa.join("، ") || "----"}</span>
        </p>
        <p className="break-words whitespace-pre-wrap text-sm leading-5">
          <strong className="text-xs">توضیح مفهوم: </strong>
          <span>{proposed.concept_explained_fa || "—"}</span>
          <button type="button" onClick={onEditConcept} aria-label="ویرایش توضیح مفهوم نهایی" title="ویرایش توضیح مفهوم نهایی" className="mr-1 inline-flex cursor-pointer rounded border border-emerald-800/35 bg-background p-1 align-middle transition hover:bg-emerald-500/10 dark:border-emerald-300/35">
            <ActionIcon name="edit" className="size-3.5" />
          </button>
        </p>
        <button type="button" onClick={onOpenSentences} className="mt-1 justify-self-start rounded-md border-2 border-emerald-800/45 bg-background px-2.5 py-1.5 text-xs font-semibold shadow-sm transition hover:bg-emerald-500/10 dark:border-emerald-300/45">
          نمایش جملات ({proposed.sentenceIds.length.toLocaleString("fa-IR")})
        </button>
      </div>
    </article>
  );
}

function buildPreviewUnits(
  groups: SourceRow[][],
  sourceGroups: number[][],
  output: OutputRow[],
): PreviewUnit[] {
  const outputById = new Map(output.map((row) => [row.id, row]));
  return sourceGroups.flatMap((sourceIds, index) => {
    const sourceRows = groups[index] ?? [];
    const currentById = new Map(sourceRows.map((row) => [row.id, row]));
    const outputRows = sourceIds.flatMap((id) => {
      const row = outputById.get(id);
      return row ? [row] : [];
    });
    return outputRows.flatMap((row): PreviewUnit[] => {
      if (row.delete) return [];
      const mergedRows = row.mergedRecordIds.flatMap((id) => {
        const merged = outputById.get(id);
        return merged?.delete && merged.mergedIntoId === row.id ? [merged] : [];
      });
      const recordIds = [row.id, ...row.mergedRecordIds];
      const kind = row.mergedRecordIds.length > 0
        ? "merge"
        : retainedRowChanged(currentById.get(row.id), row)
          ? "update"
          : "unchanged";
      return [{
        key: `${sourceIds.join(":")}:${kind}:${row.id}`,
        kind,
        recordIds,
        sourceRows: recordIds.flatMap((id) => {
          const source = currentById.get(id);
          return source ? [source] : [];
        }),
        outputRows: [row, ...mergedRows],
      }];
    });
  });
}

let nextManualKey = 0;

function createManualEntry(): ManualIdEntry {
  return { key: ++nextManualKey, wordSenseId: "" };
}

function createManualGroup(): ManualGroupState {
  return {
    key: ++nextManualKey,
    entries: [createManualEntry(), createManualEntry()],
    englishWordId: null,
    sourceRows: [],
    response: "",
    output: [],
    status: "draft",
    busy: false,
    error: null,
    notice: null,
    resolutionAmbiguities: [],
  };
}

function ManualConceptMergeModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [promptError, setPromptError] = useState<string | null>(null);
  const [manualGroups, setManualGroups] = useState<ManualGroupState[]>(() => [createManualGroup()]);
  const [jsonModal, setJsonModal] = useState<{ groupKey: number; rowId: number } | null>(null);
  const [sentenceModal, setSentenceModal] = useState<{ groupKey: number; title: string; ids: number[] } | null>(null);
  const [conceptEdit, setConceptEdit] = useState<{ groupKey: number; rowId: number; value: string } | null>(null);

  useEffect(() => {
    if (!open || prompt) return;
    setPromptError(null);
    void fetch(`/api/ai/prompt-file?path=${encodeURIComponent(MANUAL_PROMPT_PATH)}&render=1`)
      .then(async (response) => {
        const json = (await response.json()) as { text?: string; error?: string };
        if (!response.ok || typeof json.text !== "string") throw new Error(json.error || "Could not load the manual merge prompt.");
        setPrompt(json.text);
      })
      .catch((reason) => setPromptError(reason instanceof Error ? reason.message : String(reason)));
  }, [open, prompt]);

  if (!open) return null;

  const updateGroup = (groupKey: number, updater: (group: ManualGroupState) => ManualGroupState) => {
    setManualGroups((current) => current.map((group) => group.key === groupKey ? updater(group) : group));
  };

  const parsedEntries = (group: ManualGroupState) => group.entries.map((entry) => ({
    wordSenseId: Number(entry.wordSenseId),
  }));

  const resetPreparedGroup = (group: ManualGroupState): ManualGroupState => ({
    ...group,
    englishWordId: null,
    sourceRows: [],
    response: "",
    output: [],
    status: "draft",
    error: null,
    notice: null,
    resolutionAmbiguities: [],
  });

  const prepareGroup = async (groupKey: number) => {
    const group = manualGroups.find((item) => item.key === groupKey);
    if (!group) return;
    const entries = parsedEntries(group);
    const selectedIds = entries.map((entry) => entry.wordSenseId);
    if (entries.some((entry) => !Number.isSafeInteger(entry.wordSenseId) || entry.wordSenseId <= 0)) {
      updateGroup(groupKey, (current) => ({ ...current, error: "هر ردیف باید یک WordSense ID مثبت داشته باشد." }));
      return;
    }
    const overlappingId = manualGroups
      .filter((item) => item.key !== groupKey && item.status !== "applied")
      .flatMap((item) => parsedEntries(item).map((entry) => entry.wordSenseId))
      .find((id) => selectedIds.includes(id) && Number.isSafeInteger(id) && id > 0);
    if (overlappingId) {
      updateGroup(groupKey, (current) => ({ ...current, error: `WordSense ${overlappingId} در یک گروه دستی دیگر هم استفاده شده است.` }));
      return;
    }
    updateGroup(groupKey, (current) => ({ ...current, busy: true, error: null, notice: null }));
    try {
      const response = await fetch("/api/words/concept-merge/manual/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        entries?: Array<{ wordSenseId: number }>;
        englishWordId?: number;
        items?: SourceRow[];
        error?: string;
      };
      if (!response.ok || !json.ok || !Array.isArray(json.entries) || !Number.isSafeInteger(json.englishWordId) || !Array.isArray(json.items)) {
        throw new Error(json.error || "Could not prepare the manual merge group.");
      }
      updateGroup(groupKey, (current) => ({
        ...current,
        englishWordId: json.englishWordId!,
        entries: json.entries!.map((entry) => ({
          key: createManualEntry().key,
          wordSenseId: String(entry.wordSenseId),
        })),
        sourceRows: json.items!,
        response: "",
        output: [],
        status: "ready",
        busy: false,
        error: null,
        notice: `IDها اعتبارسنجی شدند؛ همه متعلق به EnglishWord #${json.englishWordId} هستند و پرامپت آماده است ✓`,
        resolutionAmbiguities: [],
      }));
    } catch (reason) {
      updateGroup(groupKey, (current) => ({
        ...current,
        busy: false,
        error: reason instanceof Error ? reason.message : String(reason),
      }));
    }
  };

  const previewGroup = async (groupKey: number) => {
    const group = manualGroups.find((item) => item.key === groupKey);
    if (!group) return;
    updateGroup(groupKey, (current) => ({ ...current, busy: true, error: null, notice: null }));
    try {
      const output = JSON.parse(group.response) as unknown;
      const response = await fetch("/api/words/concept-merge/manual/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: parsedEntries(group), output }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        mergeable?: boolean;
        items?: SourceRow[];
        output?: OutputRow[];
        error?: string;
      };
      if (!response.ok || !json.ok || typeof json.mergeable !== "boolean" || !Array.isArray(json.items) || !Array.isArray(json.output)) {
        throw new Error(json.error || "Could not validate the manual merge response.");
      }
      updateGroup(groupKey, (current) => ({
        ...current,
        sourceRows: json.items!,
        output: json.output!,
        status: "preview",
        busy: false,
        error: null,
        notice: "پاسخ معتبر است؛ پیش‌نمایش را بررسی و در صورت تأیید اعمال کنید.",
        resolutionAmbiguities: [],
      }));
    } catch (reason) {
      updateGroup(groupKey, (current) => ({
        ...current,
        busy: false,
        error: reason instanceof Error ? reason.message : String(reason),
      }));
    }
  };

  const applyGroup = async (groupKey: number, selections: PersianWordResolutionSelection[] = []) => {
    const group = manualGroups.find((item) => item.key === groupKey);
    if (!group || group.status !== "preview") return;
    updateGroup(groupKey, (current) => ({ ...current, busy: true, error: null }));
    try {
      const response = await fetch("/api/words/concept-merge/manual/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: parsedEntries(group),
          output: group.output,
          ...(selections.length ? { persian_word_resolutions: selections } : {}),
        }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        code?: string;
        ambiguities?: PersianWordAmbiguity[];
        updated?: number;
        deleted?: number;
        error?: string;
      };
      if (response.status === 409 && json.code === "PERSIAN_WORD_RESOLUTION_REQUIRED" && Array.isArray(json.ambiguities) && json.ambiguities.length) {
        updateGroup(groupKey, (current) => ({ ...current, busy: false, resolutionAmbiguities: json.ambiguities! }));
        return;
      }
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not apply the manual concept merge.");
      updateGroup(groupKey, (current) => ({
        ...current,
        status: "applied",
        busy: false,
        notice: `مرج اعمال شد: ${json.updated ?? 0} رکورد به‌روزرسانی و ${json.deleted ?? 0} رکورد حذف شد ✓`,
        resolutionAmbiguities: [],
      }));
      onApplied();
    } catch (reason) {
      updateGroup(groupKey, (current) => ({
        ...current,
        busy: false,
        error: reason instanceof Error ? reason.message : String(reason),
      }));
    }
  };

  const sentenceGroup = sentenceModal ? manualGroups.find((group) => group.key === sentenceModal.groupKey) : undefined;
  const sentenceById = new Map(
    (sentenceGroup?.sourceRows ?? []).flatMap((source) => source.sentences.map((sentence) => [sentence.id, sentence] as const)),
  );
  const jsonGroup = jsonModal ? manualGroups.find((group) => group.key === jsonModal.groupKey) : undefined;
  const jsonCurrent = jsonModal ? jsonGroup?.sourceRows.find((row) => row.id === jsonModal.rowId) : undefined;
  const jsonProposed = jsonModal ? jsonGroup?.output.find((row) => row.id === jsonModal.rowId) : undefined;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="مرج مفاهیم با ID">
      <div dir="rtl" className="flex h-[90vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-5 shadow-elevated">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-card pb-3">
          <div dir="rtl" className="text-right">
            <h2 className="text-lg font-bold">مرج مفاهیم با ID</h2>
            <p className="mt-1 text-xs opacity-70">هر گروه یک پرامپت، پاسخ، پیش‌نمایش و تأیید مستقل دارد. تمام WordSenseهای اعتبارسنجی‌شده باید در یک Concept ادغام شوند.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setManualGroups((current) => [...current, createManualGroup()])} className={buttonClass}>افزودن گروه جدید</button>
            <PromptSourcesButton paths={MANUAL_PROMPT_SOURCE_PATHS} />
            <button type="button" disabled={manualGroups.some((group) => group.busy)} onClick={onClose} className={buttonClass}>بستن</button>
          </div>
        </div>
        {promptError ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{promptError}</div> : null}
        <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
          {manualGroups.map((group, groupIndex) => {
            const copyData = group.sourceRows.map((row) => ({
              englishWordId: group.englishWordId,
              wordSenseId: row.id,
              wordSense: row,
            }));
            const copyText = `${prompt}\n\n${JSON.stringify(copyData, null, 2)}`;
            const survivor = group.output.find((row): row is RetainedOutputRow => !row.delete);
            const removed = group.output.filter((row): row is Extract<OutputRow, { delete: true }> => row.delete);
            const sourceById = new Map(group.sourceRows.map((row) => [row.id, row]));
            return (
              <section key={group.key} className="overflow-hidden rounded-xl border-2 border-black/45 bg-black/[0.025] shadow-sm dark:border-white/40 dark:bg-white/[0.025]">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/30 bg-background px-3 py-2 dark:border-white/30">
                  <div dir="rtl" className="font-bold">گروه {groupIndex + 1}</div>
                  {manualGroups.length > 1 && group.status !== "applied" ? (
                    <button type="button" disabled={group.busy} onClick={() => setManualGroups((current) => current.filter((item) => item.key !== group.key))} className={buttonClass}>حذف این گروه</button>
                  ) : null}
                </header>
                <div className="grid gap-4 p-3">
                  <div className="grid gap-2">
                    {group.entries.map((entry, entryIndex) => {
                      const sourceRow = group.sourceRows.find((row) => row.id === Number(entry.wordSenseId));
                      return (
                        <div key={entry.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-card bg-background p-2">
                          <span dir="rtl" className="pb-2 text-xs font-semibold">Concept {entryIndex + 1}</span>
                          <label className="grid gap-1 text-xs">WordSense ID<input type="number" min="1" value={entry.wordSenseId} disabled={group.busy || group.status === "applied"} onChange={(event) => updateGroup(group.key, (current) => resetPreparedGroup({ ...current, entries: current.entries.map((item) => item.key === entry.key ? { ...item, wordSenseId: event.target.value } : item) }))} className="w-36 rounded border px-2 py-1.5 font-mono" /></label>
                          {sourceRow ? (
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-blue-500/25 bg-blue-500/[0.06] px-3 py-2">
                              <span dir="ltr" className="shrink-0 font-semibold">{sourceRow.word}</span>
                              <span dir="rtl" className="min-w-0 text-right text-sm">{sourceRow.concept_explained_fa || "بدون توضیح مفهوم"}</span>
                            </div>
                          ) : null}
                          {group.entries.length > 2 && group.status !== "applied" ? <button type="button" disabled={group.busy} onClick={() => updateGroup(group.key, (current) => resetPreparedGroup({ ...current, entries: current.entries.filter((item) => item.key !== entry.key) }))} className={buttonClass}>حذف Concept</button> : null}
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={group.busy || group.status === "applied"} onClick={() => updateGroup(group.key, (current) => resetPreparedGroup({ ...current, entries: [...current.entries, createManualEntry()] }))} className={buttonClass}>افزودن Concept به این گروه</button>
                      <button type="button" disabled={group.busy || group.status === "applied" || !prompt} onClick={() => void prepareGroup(group.key)} className={buttonClass}>{group.busy && group.status === "draft" ? "در حال بررسی…" : "اعتبارسنجی IDها و ساخت پرامپت"}</button>
                    </div>
                  </div>
                  {group.error ? <div dir="rtl" className="rounded border border-red-500/30 bg-red-500/10 p-2 text-right text-sm text-red-700">{group.error}</div> : null}
                  {group.notice ? <div dir="rtl" className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-right text-sm text-emerald-800 dark:text-emerald-200">{group.notice}</div> : null}
                  {group.sourceRows.length ? (
                    <div className="grid min-h-[300px] gap-3 lg:grid-cols-2">
                      <section dir="ltr" className="flex min-h-0 flex-col gap-2">
                        <div className="flex items-center justify-between gap-2"><b>Prompt + data</b><button type="button" disabled={!prompt} onClick={() => void navigator.clipboard.writeText(copyText).then(() => updateGroup(group.key, (current) => ({ ...current, notice: "پرامپت و دادهٔ این گروه کپی شد ✓" }))).catch((reason) => updateGroup(group.key, (current) => ({ ...current, error: reason instanceof Error ? reason.message : String(reason) })))} className={buttonClass}>Copy</button></div>
                        <textarea readOnly value={copyText} className="min-h-[260px] flex-1 rounded border p-3 font-mono text-xs" />
                      </section>
                      <section dir="ltr" className="flex min-h-0 flex-col gap-2">
                        <b>Response JSON</b>
                        <textarea value={group.response} disabled={group.busy || group.status === "applied"} onChange={(event) => updateGroup(group.key, (current) => ({ ...current, response: event.target.value, output: [], status: "ready", error: null, notice: null, resolutionAmbiguities: [] }))} placeholder='[{"id":1,"word":"...","meaning_fa":"...","other_meanings_fa":[],"concept_explained_fa":"...","sentenceIds":[],"delete":false,"mergedRecordIds":[2],"mergedIntoId":null},{"id":2,"delete":true,"mergedIntoId":1}]' className="min-h-[220px] flex-1 rounded border p-3 font-mono text-xs" />
                        <div className="flex gap-2"><button type="button" disabled={group.busy || group.status === "applied"} onClick={() => void navigator.clipboard.readText().then((value) => updateGroup(group.key, (current) => ({ ...current, response: value, output: [], status: "ready", error: null, notice: null }))).catch((reason) => updateGroup(group.key, (current) => ({ ...current, error: reason instanceof Error ? reason.message : String(reason) })))} className={buttonClass}>Paste response</button><button type="button" disabled={group.busy || group.status === "applied" || !group.response.trim()} onClick={() => void previewGroup(group.key)} className={`${buttonClass} flex-1`}>بررسی پاسخ و نمایش Preview</button></div>
                      </section>
                    </div>
                  ) : null}
                  {group.status === "preview" && survivor ? (
                    <section className="grid gap-3 rounded-xl border-2 border-emerald-700/60 bg-emerald-500/5 p-3 dark:border-emerald-300/60">
                      <div dir="rtl" className="font-bold">پیش‌نمایش مرج این گروه</div>
                      <div dir="ltr" className="flex flex-nowrap items-start gap-3 overflow-x-auto">
                        <div className="w-[280px] shrink-0"><MergeSourceCard row={survivor} current={sourceById.get(survivor.id)} retained onOpenJson={() => setJsonModal({ groupKey: group.key, rowId: survivor.id })} /></div>
                        {removed.map((row) => <div key={row.id} className="w-[280px] shrink-0"><MergeSourceCard row={row} current={sourceById.get(row.id)} retained={false} onOpenJson={() => setJsonModal({ groupKey: group.key, rowId: row.id })} /></div>)}
                        <div className="min-w-[500px] flex-1 self-stretch"><MergeResultCard proposed={survivor} onOpenSentences={() => setSentenceModal({ groupKey: group.key, title: `جملات نهایی WordSense #${survivor.id}`, ids: survivor.sentenceIds })} onEditConcept={() => setConceptEdit({ groupKey: group.key, rowId: survivor.id, value: survivor.concept_explained_fa })} /></div>
                      </div>
                      <div className="flex justify-end"><button type="button" dir="rtl" disabled={group.busy} onClick={() => void applyGroup(group.key)} className={`${buttonClass} border-emerald-700 bg-emerald-600 px-5 font-bold text-white hover:bg-emerald-700 dark:border-emerald-300`}>{group.busy ? "در حال اعمال…" : "تأیید و اعمال این مرج"}</button></div>
                    </section>
                  ) : null}
                </div>
                <PersianWordResolutionModal ambiguities={group.resolutionAmbiguities} busy={group.busy} description="اعمال مرج دستی متوقف شده و هنوز هیچ تغییری ذخیره نشده است. PersianWord ID با تلفظ درست را انتخاب کنید تا همین Preview دوباره اعمال شود." onCancel={() => updateGroup(group.key, (current) => ({ ...current, resolutionAmbiguities: [], error: "اعمال لغو شد؛ هیچ انتخاب مبهمی ذخیره نشد." }))} onConfirm={(selections) => void applyGroup(group.key, selections)} />
              </section>
            );
          })}
        </div>
      </div>
      {jsonModal && jsonProposed ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setJsonModal(null)}><div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-black/60 bg-background shadow-elevated dark:border-white/50"><div className="flex items-center justify-between gap-3 border-b-2 border-black/45 px-4 py-3 dark:border-white/40"><strong>WordSense #{jsonModal.rowId}</strong><button type="button" onClick={() => setJsonModal(null)} className={buttonClass}>بستن</button></div><div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-2"><section className="min-w-0 border-b-2 border-black/45 p-4 dark:border-white/40 md:border-b-0 md:border-r-2"><b>Current JSON</b><pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(jsonCurrent ?? "Not loaded", null, 2)}</pre></section><section className="min-w-0 p-4"><b>Proposed JSON</b><pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(jsonProposed, null, 2)}</pre></section></div></div></div> : null}
      {sentenceModal ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setSentenceModal(null)}><div className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-black/60 bg-background shadow-elevated dark:border-white/50"><div className="flex items-center justify-between gap-3 border-b-2 border-black/45 px-4 py-3 dark:border-white/40"><strong dir="rtl">{sentenceModal.title}</strong><button type="button" onClick={() => setSentenceModal(null)} className={buttonClass}>بستن</button></div><div className="min-h-0 flex-1 overflow-auto p-4"><SentenceList ids={sentenceModal.ids} sentenceById={sentenceById} /></div></div></div> : null}
      {conceptEdit ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setConceptEdit(null)}><div className="w-full max-w-3xl rounded-2xl border-2 border-black/60 bg-background p-4 shadow-elevated dark:border-white/50"><div className="mb-3 flex items-center justify-between gap-3"><strong dir="rtl">ویرایش توضیح مفهوم نهایی</strong><button type="button" onClick={() => setConceptEdit(null)} className={buttonClass}>لغو</button></div><textarea dir="rtl" value={conceptEdit.value} onChange={(event) => setConceptEdit((current) => current ? { ...current, value: event.target.value } : current)} rows={8} className="w-full rounded border p-3 text-right leading-7" /><div className="mt-3 flex justify-end"><button type="button" dir="rtl" onClick={() => { updateGroup(conceptEdit.groupKey, (group) => ({ ...group, output: group.output.map((row) => row.id === conceptEdit.rowId && !row.delete ? { ...row, concept_explained_fa: conceptEdit.value.trim() } : row), notice: "توضیح مفهوم در Preview ویرایش شد؛ پیش از Apply دوباره آن را کنترل کنید." })); setConceptEdit(null); }} className={buttonClass}>ذخیره در Preview</button></div></div></div> : null}
    </div>
  );
}

export default function WordSenseConceptMerge({
  remainingGroupCount,
  remainingRecordCount,
}: {
  remainingGroupCount: number;
  remainingRecordCount: number;
}) {
  const router = useRouter();
  const pendingAgent = usePendingAgentArtifact("merge_word_concepts");
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [showSelectionHelp, setShowSelectionHelp] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(String(remainingGroupCount));
  const [prompt, setPrompt] = useState("");
  const [groups, setGroups] = useState<SourceRow[][]>([]);
  const [sourceGroups, setSourceGroups] = useState<number[][]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<OutputRow[]>([]);
  const [previewDecisions, setPreviewDecisions] = useState<Record<string, PreviewDecision>>({});
  const [jsonModalRowId, setJsonModalRowId] = useState<number | null>(null);
  const [sentenceModal, setSentenceModal] = useState<SentenceModalState | null>(null);
  const [conceptEditRowId, setConceptEditRowId] = useState<number | null>(null);
  const [conceptEditValue, setConceptEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolutionAmbiguities, setResolutionAmbiguities] = useState<PersianWordAmbiguity[]>([]);
  useEffect(() => setLimit(String(remainingGroupCount)), [remainingGroupCount]);
  const clearLoadedBatch = () => {
    setGroups([]);
    setSourceGroups([]);
    setResponse("");
    setPreview([]);
    setPreviewDecisions({});
    setJsonModalRowId(null);
    setSentenceModal(null);
    setConceptEditRowId(null);
    setConceptEditValue("");
    setResolutionAmbiguities([]);
    setNotice(null);
  };

  const createData = async (showModal: boolean, successNotice?: string) => {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 0) {
      setError("Count must be a non-negative integer.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const [promptResponse, dataResponse] = await Promise.all([
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent(PROMPT_PATH)}&render=1`),
        fetch("/api/words/concept-merge/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: parsedLimit }),
        }),
      ]);
      const promptJson = (await promptResponse.json()) as { text?: string; error?: string };
      const dataJson = (await dataResponse.json()) as PrepareResponse;
      if (!promptResponse.ok || typeof promptJson.text !== "string") {
        throw new Error(promptJson.error || "Could not load the merge prompt.");
      }
      if (!dataResponse.ok || !dataJson.ok || !Array.isArray(dataJson.items) || !Array.isArray(dataJson.sourceGroups)) {
        throw new Error(dataJson.error || "Could not prepare merge candidates.");
      }
      setPrompt(promptJson.text);
      setGroups(dataJson.items);
      setSourceGroups(dataJson.sourceGroups);
      setTotalGroups(dataJson.totalEligibleGroups ?? dataJson.items.length);
      setResponse("");
      setPreview([]);
      setPreviewDecisions({});
      setJsonModalRowId(null);
      setSentenceModal(null);
      setConceptEditRowId(null);
      setConceptEditValue("");
      setNotice(successNotice ??
        `Created data with ${dataJson.items.length} group(s); marked ${dataJson.reviewedSingleRecords ?? 0} single record(s) as reviewed ✓`);
      if (showModal) setOpen(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const parseForPreview = async (responseValue = response) => {
    setBusy(true);
    setError(null);
    try {
      const value = JSON.parse(responseValue) as unknown;
      const recordsResponse = await fetch("/api/words/concept-merge/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: value }),
      });
      const recordsJson = (await recordsResponse.json()) as {
        ok?: boolean;
        output?: OutputRow[];
        items?: SourceRow[][];
        sourceGroups?: number[][];
        error?: string;
      };
      if (!recordsResponse.ok || !recordsJson.ok || !Array.isArray(recordsJson.output) ||
          !Array.isArray(recordsJson.items) || !Array.isArray(recordsJson.sourceGroups)) {
        throw new Error(recordsJson.error || "Could not rebuild concept groups from this response.");
      }
      const rows = recordsJson.output;
      const currentById = new Map(recordsJson.items.flat().map((row) => [row.id, row]));
      const normalizedRows = rows.map((row) => {
        if (row.delete) return row;
        const mergedRecordIds = Array.isArray(row.mergedRecordIds)
          ? row.mergedRecordIds.filter((id): id is number => Number.isSafeInteger(id))
          : [];
        const clusterIds = [row.id, ...mergedRecordIds];
        const sentenceIds = [...new Set(clusterIds.flatMap((id) => {
          const current = currentById.get(id);
          return current
            ? current.sentenceIds
            : [];
        }))];
        return { ...row, sentenceIds };
      });
      const normalizedById = new Map(normalizedRows.map((row) => [row.id, row]));
      for (const row of normalizedRows) {
        if (row.delete) {
          const target = normalizedById.get(row.mergedIntoId);
          if (!target || target.delete || !target.mergedRecordIds.includes(row.id)) {
            throw new Error(`Merge references for deleted record ${row.id} are inconsistent.`);
          }
          continue;
        }
        for (const mergedId of row.mergedRecordIds) {
          const merged = normalizedById.get(mergedId);
          if (!merged?.delete || merged.mergedIntoId !== row.id) {
            throw new Error(`Merge references for retained record ${row.id} are inconsistent.`);
          }
        }
      }
      setGroups(recordsJson.items);
      setSourceGroups(recordsJson.sourceGroups);
      setTotalGroups(recordsJson.items.length);
      setPreview(normalizedRows);
      setPreviewDecisions({});
      setJsonModalRowId(null);
      setSentenceModal(null);
      setConceptEditRowId(null);
      setConceptEditValue("");
      setNotice(`Rebuilt and validated ${recordsJson.sourceGroups.length} current group(s) from the response IDs ✓`);
      setConfirmOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const applyConfirmed = async (selections: PersianWordResolutionSelection[] = []) => {
    const currentPreviewUnits = buildPreviewUnits(groups, sourceGroups, preview);
    const changedUnits = currentPreviewUnits.filter((unit) => unit.kind !== "unchanged");
    const undecidedUnits = changedUnits.filter(
      (unit) => !previewDecisions[unit.key],
    );
    if (undecidedUnits.length) {
      setError(`${undecidedUnits.length} change(s) still need a decision.`);
      return;
    }
    const reviewOnlyRecordIds = currentPreviewUnits.flatMap((unit) =>
      unit.kind === "unchanged" || previewDecisions[unit.key] === "reject" ? unit.recordIds : [],
    );
    const deferredRecordIds = changedUnits.flatMap((unit) =>
      previewDecisions[unit.key] === "defer" ? unit.recordIds : [],
    );
    const deferredCount = changedUnits.filter((unit) => previewDecisions[unit.key] === "defer").length;
    setBusy(true);
    setError(null);
    try {
      const applyResponse = await fetch("/api/words/concept-merge/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceGroups,
          output: preview,
          reviewOnlyRecordIds,
          deferredRecordIds,
          ...(selections.length ? { persian_word_resolutions: selections } : {}),
        }),
      });
      const result = (await applyResponse.json()) as {
        ok?: boolean;
        code?: string;
        ambiguities?: PersianWordAmbiguity[];
        updated?: number;
        deleted?: number;
        reviewedOnly?: number;
        deferred?: number;
        error?: string;
      };
      if (
        applyResponse.status === 409 &&
        result.code === "PERSIAN_WORD_RESOLUTION_REQUIRED" &&
        Array.isArray(result.ambiguities) &&
        result.ambiguities.length
      ) {
        setResolutionAmbiguities(result.ambiguities);
        return;
      }
      if (!applyResponse.ok || !result.ok) throw new Error(result.error || "Could not apply concept merges.");
      if (agentRunId) {
        await completeAgentArtifact(agentRunId);
        setAgentRunId(null);
        await pendingAgent.refresh();
      }
      setResolutionAmbiguities([]);
      setConfirmOpen(false);
      setResponse("");
      router.refresh();
      if (deferredCount) {
        setGroups([]);
        setSourceGroups([]);
        setPreview([]);
        setPreviewDecisions({});
        setJsonModalRowId(null);
        setSentenceModal(null);
        setConceptEditRowId(null);
        setConceptEditValue("");
        setNotice(
          `Processed ${result.updated ?? 0} retained, ${result.deleted ?? 0} deleted, and ${result.reviewedOnly ?? 0} review-only WordSense record(s); kept ${result.deferred ?? 0} record(s) across ${deferredCount} change(s) pending ✓`,
        );
        return;
      }
      await createData(
        false,
        `Processed ${result.updated ?? 0} retained, ${result.deleted ?? 0} deleted, and ${result.reviewedOnly ?? 0} review-only WordSense record(s) ✓`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const sourceById = new Map(groups.flat().map((row) => [row.id, row]));
  const sentenceById = new Map(
    groups.flatMap((group) => group.flatMap((source) => source.sentences.map((sentence) => [sentence.id, sentence] as const))),
  );
  const previewUnits = buildPreviewUnits(groups, sourceGroups, preview);
  const changedPreviewUnits = previewUnits.filter((unit) => unit.kind !== "unchanged");
  const unchangedPreviewUnits = previewUnits.filter((unit) => unit.kind === "unchanged");
  const undecidedChangedCount = changedPreviewUnits.filter((unit) => !previewDecisions[unit.key]).length;
  const changedRecordCount = changedPreviewUnits.reduce((sum, unit) => sum + unit.outputRows.length, 0);
  const unchangedRecordCount = unchangedPreviewUnits.reduce((sum, unit) => sum + unit.outputRows.length, 0);
  const jsonModalRow = jsonModalRowId === null ? undefined : preview.find((row) => row.id === jsonModalRowId);
  const jsonModalCurrent = jsonModalRowId === null ? undefined : sourceById.get(jsonModalRowId);
  const openConceptEditor = (row: RetainedOutputRow) => {
    setConceptEditRowId(row.id);
    setConceptEditValue(row.concept_explained_fa);
  };
  const copyText = `${prompt}\n\n${JSON.stringify(groups, null, 2)}`;
  const openStage = async () => {
    setBusy(true);
    setError(null);
    try {
      const artifact = await pendingAgent.loadResponse();
      if (!artifact || artifact.response === undefined) {
        await createData(true);
        return;
      }
      const savedResponse = JSON.stringify(artifact.response, null, 2);
      setResponse(savedResponse);
      setAgentRunId(artifact.runId);
      setOpen(true);
      await parseForPreview(savedResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="inline-flex items-start gap-1">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy && !open}
          onClick={() => void openStage()}
          className="relative rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5"
        >
          2. MERGE WORD CONCEPTS <RemainingGroupRecordBadge groupCount={remainingGroupCount} recordCount={remainingRecordCount} />
          {pendingAgent.artifact ? <span className="ml-1 text-emerald-700">AI response ready ✓</span> : null}
          {busy && !open ? (
            <span className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-background/85" aria-hidden="true">
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-current" />
            </span>
          ) : null}
          {busy && !open ? <span className="sr-only">Preparing</span> : null}
        </button>
        <BulkReviewStatusActions
          pendingCount={remainingGroupCount}
          pendingUnit="گروه در انتظار"
          confirmEndpoint="/api/words/concept-merge/confirm-all"
          resetEndpoint="/api/words/concept-merge/reset-reviewed"
          confirmSubject="بررسی‌های Merge WordSense Concept"
          confirmWarning="این کار فقط وضعیت بررسی را تأیید می‌کند؛ هیچ رکوردی ادغام یا حذف نمی‌شود."
          resetSubject="بررسی‌های Merge WordSense Concept"
          resetWarning="تمام WordSenseهای بررسی‌شده دوباره Pending می‌شوند. هیچ کانسپت، معنا یا رکوردی تغییر یا حذف نمی‌شود."
        />
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Merge word concepts — WordSense</b>
                <div className="text-xs opacity-70">
                  Candidate records are grouped by englishId and part of speech. Nothing is deleted until the human confirmation step.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  aria-expanded={showSelectionHelp}
                  aria-controls="word-concept-merge-selection-help"
                  onClick={() => setShowSelectionHelp((current) => !current)}
                  className={buttonClass}
                >
                  راهنمای انتخاب و تغییر داده‌ها
                </button>
                <button
                  type="button"
                  dir="rtl"
                  onClick={() => setManualOpen(true)}
                  className={buttonClass}
                >
                  مرج مفاهیم با ID
                </button>
                <PromptSourcesButton paths={PROMPT_SOURCE_PATHS} />
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className={buttonClass}>Close</button>
              </div>
            </div>
            {showSelectionHelp ? (
              <div
                id="word-concept-merge-selection-help"
                dir="rtl"
                className="max-h-64 overflow-auto rounded border border-blue-500/30 bg-blue-500/10 p-3 text-right text-sm leading-6"
              >
                <div className="font-semibold">هدف این مرحله</div>
                <p>
                  رکوردهای مختلف یک کلمهٔ انگلیسی بررسی می‌شوند تا مفهوم‌های
                  واقعاً یکسان در قدیمی‌ترین رکورد ترکیب و رکوردهای اضافه حذف شوند.
                </p>
                <div className="mt-2 font-semibold">شرایط انتخاب رکوردها</div>
                <ul className="list-disc pr-5">
                  <li>رکوردها بر اساس <code>englishId</code> و <code>pos</code> یکسان گروه‌بندی می‌شوند.</li>
                  <li>گروه باید حداقل دو رکورد <code>WordSense</code> داشته باشد.</li>
                  <li>حداقل یک رکورد گروه باید <code>conceptMergeReviewed=false</code> داشته باشد.</li>
                  <li>گروهی که تمام رکوردهایش بررسی شده‌اند دوباره به پرامپت ارسال نمی‌شود.</li>
                  <li>Count تعداد گروه‌هایی را تعیین می‌کند که در دادهٔ پرامپت قرار می‌گیرند.</li>
                </ul>
                <div className="mt-2 font-semibold">روش انجام کار</div>
                <ol className="list-decimal pr-5">
                  <li><code>Create data</code> را بزنید و Prompt و دادهٔ تولیدشده را برای مدل ارسال کنید.</li>
                  <li>پاسخ کامل مدل را در بخش Response JSON قرار دهید و <code>PREVIEW CHANGES</code> را بزنید.</li>
                  <li>Preview هر Merge یا Update مستقل را به‌صورت یک کارت تصمیم‌گیری در بالای فهرست نشان می‌دهد؛ رکوردهای بدون تغییر، بدون گروه تصمیم‌گیری در پایین می‌آیند.</li>
                  <li>داخل هر Merge، رکورد نگه‌دارنده ابتدا می‌آید؛ سپس رکوردهای قرمز حذف‌شونده و در پایان نتیجهٔ نهایی بدون علامت واسط قرار می‌گیرند. نوار بلند افقی Scroll می‌خورد و به ردیف دوم نمی‌رود.</li>
                  <li>کارت‌های کوچک Merge معنی اصلی، معنی‌های دیگر و توضیح مفهوم را به‌شکل متن ساده نشان می‌دهند؛ جمله‌ها در این نوار نمایش داده نمی‌شوند. کارت نتیجه معنی‌های دیگر و توضیح مفهوم نهایی را نشان می‌دهد و معنی اصلی را تکرار نمی‌کند.</li>
                  <li>در Update، کلمه و معنی اصلی فقط یک بار کنار کنترل <code>#ID · J</code> می‌آیند؛ مقدار قبلی فیلدهای تغییرکرده در کادر قرمز و مقدار جدید در کادر سبز نمایش داده می‌شود و جدول مقایسه وجود ندارد.</li>
                  <li>کنترل <code>#ID · J</code> اطلاعات فعلی و پیشنهادی همان رکورد را در مودال JSON باز می‌کند؛ آیکن سطل زباله نیز رکورد حذف‌شونده را مشخص می‌کند.</li>
                  <li>دکمهٔ «نمایش جملات» در کارت نتیجه، فهرست جمله‌های نهایی را در مودال جدا باز می‌کند.</li>
                  <li>آیکن مداد کنار توضیح مفهوم نهایی Merge یا توضیح پیشنهادی Update، مودال ویرایش همان فیلد را باز می‌کند. ذخیره ابتدا فقط Preview را عوض می‌کند و تصمیم قبلی همان تغییر را برای تأیید دوباره پاک می‌کند.</li>
                  <li>معنی‌ها بدون کروشه و متناسب با جهت فارسی نمایش داده می‌شوند؛ معنی افزوده‌شونده فقط با رنگ سبز مشخص می‌شود.</li>
                  <li>برای هر Merge یا Update یکی از سه تصمیم «موافقم»، «مخالفم؛ بدون تغییر بماند» یا «بعداً دوباره بررسی شود» را مستقل انتخاب کنید.</li>
                  <li>پس از تصمیم‌گیری دربارهٔ تمام تغییرهای پیشنهادی، دکمهٔ اعمال تصمیم‌ها را بزنید.</li>
                  <li>اگر معنی فارسی تغییر نکرده باشد، سیستم همان PersianWord ID فعلی را خودکار حفظ می‌کند و انتخاب دیگری لازم نیست.</li>
                  <li>اگر برای یک معنی چند PersianWord با تلفظ‌های متفاوت وجود داشته باشد، مودال انتخاب تلفظ باز می‌شود. کلمهٔ انگلیسی، مفهوم، نقش دستوری و IPAها را مقایسه و ID متعلق به همان کاربرد را انتخاب کنید.</li>
                  <li>پس از زدن «تأیید و ادامه»، همان Preview با انتخاب شما دوباره Apply می‌شود؛ پاسخ مدل و Preview را دوباره تولید نکنید.</li>
                  <li>اگر مودال را لغو کنید یا خطای دیگری رخ دهد، تراکنش کامل rollback می‌شود و هیچ Merge یا حذف نیمه‌کاره‌ای ذخیره نخواهد شد.</li>
                </ol>
                <div className="mt-2 font-semibold">پس از تأیید چه تغییری می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li>در هر مفهوم ادغام‌شده، قدیمی‌ترین WordSense باقی می‌ماند و <code>meaningId</code>، <code>otherMeaningIds</code> و <code>concept_explained_fa</code> آن با نتیجهٔ نهایی به‌روزرسانی می‌شوند.</li>
                  <li>تمام جمله‌های معتبر گروه بدون تکرار در <code>sentenceIds</code> رکورد باقی‌مانده جمع می‌شوند و ترتیب آن‌ها حفظ می‌شود.</li>
                  <li>WordSenseهای جدیدترِ ادغام‌شده حذف می‌شوند، اما رکوردهای Sentence و PersianWord حذف نمی‌شوند.</li>
                  <li>معنی فارسی بدون تغییر با همان PersianWord ID حفظ می‌شود؛ معنی واقعاً مبهم فقط پس از انتخاب تلفظ/ID درست اعمال می‌شود.</li>
                  <li>ارجاع به WordSenseهای حذف‌شده از <code>synonymIds</code> و <code>comparedMeaningWordIds</code> سایر رکوردها پاک می‌شود.</li>
                  <li>«مخالفم» فقط همان Merge یا Update را لغو می‌کند، رکوردهای مرتبط را بدون تغییر محتوایی نگه می‌دارد و آن‌ها را بررسی‌شده علامت می‌زند.</li>
                  <li>«بعداً دوباره بررسی شود» فقط همان Merge یا Update را بدون تغییر Pending نگه می‌دارد؛ تصمیم سایر تغییرهای همان کلمه مستقل اعمال می‌شود.</li>
                  <li>گروه تک‌رکوردی به مدل فرستاده نمی‌شود و فقط بررسی‌شده علامت می‌خورد.</li>
                  <li>هیچ ستون دیتابیس حذف نمی‌شود؛ فقط مقدارهای بالا تغییر می‌کنند و ردیف‌های WordSense اضافه حذف می‌شوند.</li>
                </ul>
                <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-2">
                  <div className="font-semibold">برای آپدیت‌های بعدی</div>
                  <p>
                    فعلاً JSON فقط خواندنی باقی می‌ماند. قابلیت جابه‌جایی معنی اصلی و <code>other_meanings_fa</code>
                    بعداً فقط برای گروهی بررسی می‌شود که کاربر Merge آن را پذیرفته باشد؛ اصلاح مستقل معنی باید در مرحلهٔ
                    Review Persian Meanings انجام شود، نه در گروه بدون تغییر.
                  </p>
                </div>
                <div className="mt-2 font-semibold">نگرانی</div>
                <p>
                  نیازی به نگرانی دربارهٔ اثر یک Merge بر گروه‌های بعدی نیست؛ هر گروه مستقل است و فهرست‌ها با هم هم‌پوشانی ندارند.
                  پس از Apply، فهرست بعدی از وضعیت تازه ساخته می‌شود و فهرست تکراری یا قدیمی در اعتبارسنجی رد خواهد شد.
                </p>
                <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">
                  وضعیت انتخاب رکوردها فقط از <code>conceptMergeReviewed</code> خوانده می‌شود و به جمله‌ها وابسته نیست.
                </p>
              </div>
            ) : null}
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <PromptBatchControls
                    batchSize={limit}
                    disabled={busy}
                    loadedCount={groups.length}
                    totalEligibleCount={totalGroups}
                    onBatchSizeChange={(value) => { clearLoadedBatch(); setLimit(value); }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={busy} onClick={() => void createData(false)} className={buttonClass}>
                    {busy ? "Creating…" : "Create data"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || groups.length === 0}
                    onClick={() => void navigator.clipboard.writeText(copyText).then(() => setNotice("Prompt and grouped data copied ✓")).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Copy prompt + data</button>
                  <RemainingCountButton
                    count={totalGroups}
                    disabled={busy}
                    onClick={() => setLimit(String(totalGroups))}
                  />
                  </div>
                </div>
                <textarea readOnly value={copyText} className="min-h-0 flex-1 rounded border p-3 font-mono text-xs" />
              </section>
              <section className="flex min-h-0 flex-col gap-2">
                <b>Response JSON</b>
                <textarea
                  value={response}
                  disabled={busy}
                  onChange={(event) => setResponse(event.target.value)}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                  placeholder='[{"id":1,"word":"...","meaning_fa":"...","other_meanings_fa":[],"concept_explained_fa":"...","sentenceIds":[],"delete":false,"mergedRecordIds":[],"mergedIntoId":null}]'
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void navigator.clipboard.readText().then(setResponse).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Paste response</button>
                  <button type="button" disabled={busy || !response.trim()} onClick={() => void parseForPreview()} className={`${buttonClass} flex-1`}>
                    PREVIEW CHANGES
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="flex h-[85vh] w-full max-w-6xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Confirm concept merges</b>
                <div dir="rtl" className="text-right text-xs opacity-70">
                  هر Merge یا Update مستقل را جداگانه بررسی کنید. موارد بدون تغییر در انتهای فهرست آمده‌اند.
                </div>
              </div>
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className={buttonClass}>Back without saving</button>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border-2 border-black/45 bg-black/[0.035] p-3 dark:border-white/40 dark:bg-white/[0.035]">
              <section className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/45 pb-2 dark:border-white/40">
                  <h3 dir="rtl" className="text-base font-bold">تغییرهای پیشنهادی</h3>
                  <span dir="rtl" className="rounded-full border border-black/35 bg-background px-2.5 py-1 text-xs dark:border-white/35">
                    {changedPreviewUnits.length.toLocaleString("fa-IR")} تغییر · {changedRecordCount.toLocaleString("fa-IR")} رکورد
                  </span>
                </div>
                {changedPreviewUnits.map((unit, unitIndex) => {
                  const decision = previewDecisions[unit.key];
                  const unitWord = unit.sourceRows[0]?.word ?? "Unknown";
                  const mergeSurvivor = unit.kind === "merge"
                    ? unit.outputRows.find((row): row is RetainedOutputRow => !row.delete)
                    : undefined;
                  const mergeDeletedRows = unit.kind === "merge"
                    ? unit.outputRows.filter((row): row is Extract<OutputRow, { delete: true }> => row.delete)
                    : [];
                  const updateRow = unit.kind === "update"
                    ? unit.outputRows.find((row): row is RetainedOutputRow => !row.delete)
                    : undefined;
                  const updateCurrent = updateRow ? sourceById.get(updateRow.id) : undefined;
                  const alternatingUnitClass = unitIndex % 2 === 0
                    ? "bg-sky-50/90 dark:bg-sky-950/25"
                    : "bg-violet-50/90 dark:bg-violet-950/25";
                  const statusBorderClass = decision === "approve"
                    ? "border-r-emerald-600"
                    : decision === "reject"
                      ? "border-r-red-600"
                      : decision === "defer"
                        ? "border-r-amber-600"
                        : "border-r-black/70 dark:border-r-white/70";
                  return (
                    <section key={unit.key} className={`overflow-hidden rounded-xl border-2 border-r-4 border-black/55 shadow-[0_3px_8px_rgba(0,0,0,0.13)] dark:border-white/45 ${alternatingUnitClass} ${statusBorderClass}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black/40 bg-white/55 p-3 dark:border-white/35 dark:bg-black/20">
                        <div className="flex items-start gap-3">
                          <span dir="rtl" className="rounded-md border-2 border-black/35 bg-background px-2 py-1 text-xs font-semibold shadow-sm dark:border-white/35">
                            {unit.kind === "merge" ? "Merge" : "Update"} {unitIndex + 1} از {changedPreviewUnits.length}
                          </span>
                          {updateRow ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <button type="button" dir="ltr" onClick={() => setJsonModalRowId(updateRow.id)} title={`نمایش JSON رکورد ${updateRow.id}`} aria-label={`نمایش JSON رکورد ${updateRow.id}`} className="inline-flex cursor-pointer items-center overflow-hidden rounded-md border-2 border-black/45 bg-background text-xs font-semibold shadow-sm transition hover:bg-black/[0.05] dark:border-white/40 dark:hover:bg-white/[0.06]">
                                <span className="px-2 py-1 font-mono">#{updateRow.id}</span>
                                <span className="border-l-2 border-black/35 px-2 py-1 font-black dark:border-white/35">J</span>
                              </button>
                              <span dir="ltr" className="text-base font-semibold">{updateCurrent?.word ?? updateRow.word}</span>
                              <span dir="rtl" className="text-sm"><strong>معنی اصلی:</strong> {updateCurrent?.meaning_fa || "—"}</span>
                            </div>
                          ) : (
                            <div>
                              <div dir="ltr" className="text-base font-semibold">{unitWord}</div>
                              <div className="font-mono text-xs opacity-70">WordSense IDs: {unit.recordIds.join(", ")}</div>
                            </div>
                          )}
                        </div>
                        <fieldset dir="rtl" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border-2 border-black/30 bg-background/90 px-3 py-2 text-right text-sm shadow-sm dark:border-white/30">
                          <legend className="mb-1 w-full text-xs font-semibold">با این {unit.kind === "merge" ? "Merge" : "Update"} موافق هستید؟</legend>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input type="radio" name={`concept-merge-decision-${unit.key}`} checked={decision === "approve"} onChange={() => setPreviewDecisions((current) => ({ ...current, [unit.key]: "approve" }))} />
                            موافقم
                          </label>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input type="radio" name={`concept-merge-decision-${unit.key}`} checked={decision === "reject"} onChange={() => setPreviewDecisions((current) => ({ ...current, [unit.key]: "reject" }))} />
                            مخالفم؛ بدون تغییر بماند
                          </label>
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input type="radio" name={`concept-merge-decision-${unit.key}`} checked={decision === "defer"} onChange={() => setPreviewDecisions((current) => ({ ...current, [unit.key]: "defer" }))} />
                            بعداً دوباره بررسی شود
                          </label>
                        </fieldset>
                      </div>
                      {decision === "reject" ? (
                        <div dir="rtl" className="border-b-2 border-red-700/50 bg-red-500/10 px-3 py-2 text-right text-xs text-red-800 dark:text-red-200">
                          فقط همین تغییر اجرا نمی‌شود؛ رکوردهای آن با محتوای فعلی باقی می‌مانند و بررسی‌شده علامت می‌خورند.
                        </div>
                      ) : decision === "defer" ? (
                        <div dir="rtl" className="border-b-2 border-amber-700/50 bg-amber-500/10 px-3 py-2 text-right text-xs text-amber-800 dark:text-amber-200">
                          فقط همین تغییر کنار گذاشته می‌شود؛ رکوردهای آن بدون تغییر و Pending باقی می‌مانند.
                        </div>
                      ) : null}
                      {unit.kind === "merge" && mergeSurvivor ? (
                        <div dir="ltr" className="flex flex-nowrap items-start gap-3 overflow-x-auto p-3">
                          <div className="w-[280px] shrink-0">
                            <MergeSourceCard
                              row={mergeSurvivor}
                              current={sourceById.get(mergeSurvivor.id)}
                              retained
                              onOpenJson={() => setJsonModalRowId(mergeSurvivor.id)}
                            />
                          </div>
                          {mergeDeletedRows.map((row) => (
                            <div key={row.id} className="flex shrink-0 items-center">
                              <div className="w-[280px]">
                                <MergeSourceCard
                                  row={row}
                                  current={sourceById.get(row.id)}
                                  retained={false}
                                  onOpenJson={() => setJsonModalRowId(row.id)}
                                />
                              </div>
                            </div>
                          ))}
                          <div className="min-w-[500px] flex-1 self-stretch">
                            <MergeResultCard
                              proposed={mergeSurvivor}
                              onOpenSentences={() => setSentenceModal({
                                title: `جملات نهایی WordSense #${mergeSurvivor.id}`,
                                ids: mergeSurvivor.sentenceIds,
                              })}
                              onEditConcept={() => openConceptEditor(mergeSurvivor)}
                            />
                          </div>
                        </div>
                      ) : updateRow ? (
                        <PreviewRecordCard
                          row={updateRow}
                          current={updateCurrent}
                          onOpenJson={() => setJsonModalRowId(updateRow.id)}
                          onOpenSentences={(ids, title) => setSentenceModal({ ids, title })}
                          onEditConcept={() => openConceptEditor(updateRow)}
                          embedded
                        />
                      ) : null}
                    </section>
                  );
                })}
                {!changedPreviewUnits.length ? (
                  <div dir="rtl" className="rounded-lg border-2 border-dashed border-black/35 bg-background p-5 text-center text-sm opacity-70 dark:border-white/35">
                    هیچ Merge یا Update پیشنهادی وجود ندارد.
                  </div>
                ) : null}
              </section>

              <section className="mt-8 grid gap-2 border-t-4 border-black/50 pt-4 dark:border-white/45">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/35 pb-2 dark:border-white/35">
                  <h3 dir="rtl" className="text-base font-bold">بدون تغییر</h3>
                  <span dir="rtl" className="rounded-full border border-black/35 bg-background px-2.5 py-1 text-xs dark:border-white/35">
                    {unchangedPreviewUnits.length.toLocaleString("fa-IR")} مورد · {unchangedRecordCount.toLocaleString("fa-IR")} رکورد
                  </span>
                </div>
                {unchangedPreviewUnits.flatMap((unit) => unit.outputRows.map((row) => (
                  <PreviewRecordCard
                    key={row.id}
                    row={row}
                    current={sourceById.get(row.id)}
                    onOpenJson={() => setJsonModalRowId(row.id)}
                    onOpenSentences={(ids, title) => setSentenceModal({ ids, title })}
                  />
                )))}
                {!unchangedPreviewUnits.length ? (
                  <div dir="rtl" className="rounded-lg border-2 border-dashed border-black/35 bg-background p-5 text-center text-sm opacity-70 dark:border-white/35">
                    هیچ رکورد بدون تغییری وجود ندارد.
                  </div>
                ) : null}
              </section>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span dir="rtl" className="text-sm">
                {undecidedChangedCount > 0
                  ? `${undecidedChangedCount} تغییر هنوز تصمیم‌گیری نشده است.`
                  : "برای تمام تغییرهای پیشنهادی تصمیم‌گیری شده است."}
              </span>
              <button type="button" dir="rtl" disabled={busy || undecidedChangedCount > 0} onClick={() => void applyConfirmed()} className={buttonClass}>
                {busy ? "در حال اعمال…" : undecidedChangedCount > 0 ? `${undecidedChangedCount} تغییر باقی مانده` : "تأیید و اعمال تصمیم‌ها"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {jsonModalRow ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`WordSense ${jsonModalRow.id} JSON`}
          onMouseDown={(event) => event.target === event.currentTarget && setJsonModalRowId(null)}
        >
          <div className="flex max-h-[82vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-black/60 bg-background shadow-elevated dark:border-white/50">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black/45 px-4 py-3 dark:border-white/40">
              <div className="flex items-center gap-2">
                <strong>WordSense JSON</strong>
                <span className="font-mono text-sm">#{jsonModalRow.id}</span>
              </div>
              <button type="button" dir="rtl" onClick={() => setJsonModalRowId(null)} className={buttonClass}>بستن</button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-2">
              <section className="min-w-0 border-b-2 border-black/45 p-4 dark:border-white/40 md:border-b-0 md:border-r-2">
                <div className="mb-2 text-sm font-semibold">Current JSON</div>
                <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(jsonModalCurrent ?? "Not loaded", null, 2)}</pre>
              </section>
              <section className="min-w-0 p-4">
                <div className="mb-2 text-sm font-semibold">Proposed JSON</div>
                <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(jsonModalRow, null, 2)}</pre>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {sentenceModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={sentenceModal.title}
          onMouseDown={(event) => event.target === event.currentTarget && setSentenceModal(null)}
        >
          <div className="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-black/60 bg-background shadow-elevated dark:border-white/50">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black/45 px-4 py-3 dark:border-white/40">
              <div dir="rtl" className="text-right">
                <strong>{sentenceModal.title}</strong>
              </div>
              <button type="button" dir="rtl" onClick={() => setSentenceModal(null)} className={buttonClass}>بستن</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <SentenceList ids={sentenceModal.ids} sentenceById={sentenceById} />
            </div>
          </div>
        </div>
      ) : null}
      {conceptEditRowId !== null ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`ویرایش توضیح مفهوم WordSense ${conceptEditRowId}`}
          onMouseDown={(event) => event.target === event.currentTarget && setConceptEditRowId(null)}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-black/60 bg-background shadow-elevated dark:border-white/50">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black/45 px-4 py-3 dark:border-white/40">
              <div dir="rtl" className="text-right">
                <strong>ویرایش توضیح مفهوم</strong>
                <span dir="ltr" className="mr-2 font-mono text-sm">WordSense #{conceptEditRowId}</span>
              </div>
              <button type="button" dir="rtl" onClick={() => setConceptEditRowId(null)} className={buttonClass}>لغو</button>
            </div>
            <div className="grid gap-3 p-4">
              <textarea
                dir="rtl"
                value={conceptEditValue}
                onChange={(event) => setConceptEditValue(event.target.value)}
                rows={9}
                autoFocus
                className="w-full rounded-lg border-2 border-black/45 bg-background p-3 text-right leading-7 outline-none focus:border-blue-600 dark:border-white/40"
              />
              <button
                type="button"
                dir="rtl"
                onClick={() => {
                  const editedUnit = previewUnits.find((unit) => unit.recordIds.includes(conceptEditRowId));
                  setPreview((currentRows) => currentRows.map((row) =>
                    row.id === conceptEditRowId && !row.delete
                      ? { ...row, concept_explained_fa: conceptEditValue.trim() }
                      : row,
                  ));
                  if (editedUnit) {
                    setPreviewDecisions((current) => {
                      const next = { ...current };
                      delete next[editedUnit.key];
                      return next;
                    });
                  }
                  setConceptEditRowId(null);
                  setConceptEditValue("");
                }}
                className={`${buttonClass} justify-self-end`}
              >
                ذخیره در Preview
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PersianWordResolutionModal
        ambiguities={resolutionAmbiguities}
        busy={busy}
        description="اعمال Merge متوقف شده و هنوز هیچ تغییری ذخیره نشده است. مفهوم را بررسی کنید و PersianWord ID با تلفظ درست را انتخاب کنید؛ سپس همین preview دوباره اعمال می‌شود."
        onCancel={() => {
          setResolutionAmbiguities([]);
          setError("Apply cancelled; no ambiguous PersianWord selection was saved.");
        }}
        onConfirm={(selections) => void applyConfirmed(selections)}
      />
      <ManualConceptMergeModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onApplied={() => router.refresh()}
      />
    </>
  );
}
