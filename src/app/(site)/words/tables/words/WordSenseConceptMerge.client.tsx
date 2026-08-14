"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { ParallelPromptBatchControls } from "@/components/prompts/ParallelPromptBatchControls.client";
import { RemainingCountBadge, RemainingCountButton } from "@/components/remaining-count";
import { BulkReviewStatusActions } from "@/components/review-status/BulkReviewStatusActions.client";
import { PersianWordResolutionModal } from "@/components/words/PersianWordResolutionModal.client";
import type {
  PersianWordAmbiguity,
  PersianWordResolutionSelection,
} from "@/lib/words/persianWordResolution";

const PROMPT_PATH = "src/prompts/word-extraction/merge_word_concepts/rulseV1.md";

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

type OutputRow = Record<string, unknown> & { id: number; delete: boolean };

type PrepareResponse = {
  ok?: boolean;
  items?: SourceRow[][];
  sourceGroups?: number[][];
  totalEligibleGroups?: number;
  laneEligibleCount?: number;
  reviewedSingleRecords?: number;
  error?: string;
};

const buttonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

export default function WordSenseConceptMerge({ remainingCount }: { remainingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showSelectionHelp, setShowSelectionHelp] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState("50");
  const [laneCount, setLaneCount] = useState(1);
  const [laneNumber, setLaneNumber] = useState(1);
  const [laneEligibleCount, setLaneEligibleCount] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [groups, setGroups] = useState<SourceRow[][]>([]);
  const [sourceGroups, setSourceGroups] = useState<number[][]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<OutputRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resolutionAmbiguities, setResolutionAmbiguities] = useState<PersianWordAmbiguity[]>([]);
  const clearLoadedLane = () => {
    setGroups([]);
    setSourceGroups([]);
    setLaneEligibleCount(null);
    setResponse("");
    setPreview([]);
    setResolutionAmbiguities([]);
    setNotice(null);
  };

  const createData = async (showModal: boolean, successNotice?: string) => {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
      setError("Batch size must be a positive integer.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const [promptResponse, dataResponse] = await Promise.all([
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent(PROMPT_PATH)}`),
        fetch("/api/words/concept-merge/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: parsedLimit, laneCount, laneNumber }),
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
      setLaneEligibleCount(typeof dataJson.laneEligibleCount === "number" ? dataJson.laneEligibleCount : null);
      setResponse("");
      setPreview([]);
      setNotice(successNotice ??
        `Created lane ${laneNumber}/${laneCount} with ${dataJson.items.length} group(s); marked ${dataJson.reviewedSingleRecords ?? 0} single record(s) as reviewed ✓`);
      if (showModal) setOpen(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const parseForPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      const value = JSON.parse(response) as unknown;
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
      setGroups(recordsJson.items);
      setSourceGroups(recordsJson.sourceGroups);
      setTotalGroups(recordsJson.items.length);
      setPreview(normalizedRows);
      setNotice(`Rebuilt and validated ${recordsJson.sourceGroups.length} current group(s) from the response IDs ✓`);
      setConfirmOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const applyConfirmed = async (selections: PersianWordResolutionSelection[] = []) => {
    setBusy(true);
    setError(null);
    try {
      const applyResponse = await fetch("/api/words/concept-merge/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceGroups,
          output: preview,
          ...(selections.length ? { persian_word_resolutions: selections } : {}),
        }),
      });
      const result = (await applyResponse.json()) as {
        ok?: boolean;
        code?: string;
        ambiguities?: PersianWordAmbiguity[];
        updated?: number;
        deleted?: number;
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
      setResolutionAmbiguities([]);
      setConfirmOpen(false);
      setResponse("");
      router.refresh();
      await createData(
        false,
        `Updated ${result.updated ?? 0} and deleted ${result.deleted ?? 0} WordSense record(s) ✓`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const sourceById = new Map(groups.flat().map((row) => [row.id, row]));
  const copyText = `${prompt}\n\n${JSON.stringify(groups, null, 2)}`;
  return (
    <>
      <div className="inline-flex items-start gap-1">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy && !open}
          onClick={() => void createData(true)}
          className="relative rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5"
        >
          2. MERGE WORD CONCEPTS <RemainingCountBadge count={remainingCount} />
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
          pendingCount={remainingCount}
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
                  Candidate records are grouped by englishId. Nothing is deleted until the human confirmation step.
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
                <PromptSourcesButton paths={[PROMPT_PATH]} />
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
                  <li>رکوردها بر اساس <code>englishId</code> یکسان گروه‌بندی می‌شوند.</li>
                  <li>گروه باید حداقل دو رکورد <code>WordSense</code> داشته باشد.</li>
                  <li>حداقل یک رکورد گروه باید <code>conceptMergeReviewed=false</code> داشته باشد.</li>
                  <li>گروهی که تمام رکوردهایش بررسی شده‌اند دوباره به پرامپت ارسال نمی‌شود.</li>
                  <li>گروه‌ها به laneهای پایدار و بدون هم‌پوشانی تقسیم می‌شوند و Batch size سقف تعداد گروه در هر lane است.</li>
                </ul>
                <div className="mt-2 font-semibold">روش انجام کار</div>
                <ol className="list-decimal pr-5">
                  <li>تعداد laneها و شمارهٔ lane را تعیین کنید، سپس <code>Create data</code> را بزنید و Prompt همان lane را برای مدل ارسال کنید.</li>
                  <li>پاسخ کامل مدل را در بخش Response JSON قرار دهید و <code>PREVIEW CHANGES</code> را بزنید.</li>
                  <li>در Preview، همهٔ رکوردهای KEEP / UPDATE و DELETE را بررسی کنید؛ سپس <code>CONFIRM AND APPLY ALL</code> را بزنید.</li>
                  <li>اگر معنی فارسی تغییر نکرده باشد، سیستم همان PersianWord ID فعلی را خودکار حفظ می‌کند و انتخاب دیگری لازم نیست.</li>
                  <li>اگر برای یک معنی چند PersianWord با تلفظ‌های متفاوت وجود داشته باشد، مودال انتخاب تلفظ باز می‌شود. کلمهٔ انگلیسی، مفهوم، نقش دستوری و IPAها را مقایسه و ID متعلق به همان کاربرد را انتخاب کنید.</li>
                  <li>پس از زدن «تأیید و ادامه»، همان Preview با انتخاب شما دوباره Apply می‌شود؛ پاسخ مدل، lane و Preview را دوباره تولید نکنید.</li>
                  <li>اگر مودال را لغو کنید یا خطای دیگری رخ دهد، تراکنش کامل rollback می‌شود و هیچ Merge یا حذف نیمه‌کاره‌ای ذخیره نخواهد شد.</li>
                </ol>
                <div className="mt-2 font-semibold">پس از تأیید چه تغییری می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li>در هر مفهوم ادغام‌شده، قدیمی‌ترین WordSense باقی می‌ماند و <code>meaningId</code>، <code>otherMeaningIds</code> و <code>concept_explained_fa</code> آن با نتیجهٔ نهایی به‌روزرسانی می‌شوند.</li>
                  <li>تمام جمله‌های معتبر گروه بدون تکرار در <code>sentenceIds</code> رکورد باقی‌مانده جمع می‌شوند و ترتیب آن‌ها حفظ می‌شود.</li>
                  <li>WordSenseهای جدیدترِ ادغام‌شده حذف می‌شوند، اما رکوردهای Sentence و PersianWord حذف نمی‌شوند.</li>
                  <li>معنی فارسی بدون تغییر با همان PersianWord ID حفظ می‌شود؛ معنی واقعاً مبهم فقط پس از انتخاب تلفظ/ID درست اعمال می‌شود.</li>
                  <li>ارجاع به WordSenseهای حذف‌شده از <code>synonymIds</code> و <code>comparedMeaningWordIds</code> سایر رکوردها پاک می‌شود.</li>
                  <li>گروه تک‌رکوردی به مدل فرستاده نمی‌شود و فقط بررسی‌شده علامت می‌خورد.</li>
                  <li>هیچ ستون دیتابیس حذف نمی‌شود؛ فقط مقدارهای بالا تغییر می‌کنند و ردیف‌های WordSense اضافه حذف می‌شوند.</li>
                </ul>
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
                  <ParallelPromptBatchControls
                    batchSize={limit}
                    disabled={busy}
                    laneCount={laneCount}
                    laneNumber={laneNumber}
                    laneEligibleCount={laneEligibleCount}
                    loadedCount={groups.length}
                    totalEligibleCount={totalGroups}
                    onBatchSizeChange={(value) => { clearLoadedLane(); setLimit(value); }}
                    onLaneCountChange={(value) => { clearLoadedLane(); setLaneCount(value); }}
                    onLaneNumberChange={(value) => { clearLoadedLane(); setLaneNumber(value); }}
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
                  >Copy lane {laneNumber}</button>
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
                <div className="text-xs opacity-70">
                  Review every update and deletion. Final validation and all database changes run in one transaction.
                </div>
              </div>
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className={buttonClass}>Back without saving</button>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            <div className="min-h-0 flex-1 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b"><th className="px-3 py-2">id</th><th className="px-3 py-2">Current</th><th className="px-3 py-2">Proposed</th><th className="px-3 py-2">Result</th></tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.id} className={`border-b align-top ${row.delete ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
                      <td className="px-3 py-2 font-mono">{row.id}</td>
                      <td className="px-3 py-2"><pre className="whitespace-pre-wrap font-mono">{JSON.stringify(sourceById.get(row.id) ?? "Not loaded", null, 2)}</pre></td>
                      <td className="px-3 py-2"><pre className="whitespace-pre-wrap font-mono">{JSON.stringify(row, null, 2)}</pre></td>
                      <td className={`px-3 py-2 font-semibold ${row.delete ? "text-red-700" : "text-emerald-700"}`}>{row.delete ? "DELETE" : "KEEP / UPDATE"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                Keep {preview.filter((row) => !row.delete).length} • Delete {preview.filter((row) => row.delete).length}
              </span>
              <button type="button" disabled={busy} onClick={() => void applyConfirmed()} className={buttonClass}>
                {busy ? "APPLYING…" : "CONFIRM AND APPLY ALL"}
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
    </>
  );
}
