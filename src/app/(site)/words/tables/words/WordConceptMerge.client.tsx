"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { RemainingCountBadge, RemainingCountButton } from "@/components/remaining-count";

const PROMPT_PATH = "src/prompts/word-extraction/merge_word_concepts/rulseV1.md";

type SourceRow = {
  id: number;
  word: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string;
  sentenceIds: number[];
};

type OutputRow = Record<string, unknown> & { id: number; delete: boolean };

type PrepareResponse = {
  ok?: boolean;
  items?: SourceRow[][];
  sourceGroups?: number[][];
  totalEligibleGroups?: number;
  reviewedSingleRecords?: number;
  error?: string;
};

const buttonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

export default function WordConceptMerge({ remainingCount }: { remainingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showSelectionHelp, setShowSelectionHelp] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState("0");
  const [prompt, setPrompt] = useState("");
  const [groups, setGroups] = useState<SourceRow[][]>([]);
  const [sourceGroups, setSourceGroups] = useState<number[][]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<OutputRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const createData = async (showModal: boolean, successNotice?: string) => {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 0) {
      setError("Count must be a non-negative integer; 0 means all groups.");
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
          body: JSON.stringify({ limit: parsedLimit }),
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
      setNotice(successNotice ??
        `Created ${dataJson.items.length} group(s); marked ${dataJson.reviewedSingleRecords ?? 0} single record(s) as reviewed ✓`);
      if (showModal) setOpen(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const parseForPreview = () => {
    setError(null);
    try {
      const value = JSON.parse(response) as unknown;
      if (!Array.isArray(value) || value.length === 0) throw new Error("Response must be a non-empty JSON array.");
      const sourceIds = sourceGroups.flat();
      const rows = value as OutputRow[];
      if (rows.some((row) => !row || typeof row !== "object" || !Number.isSafeInteger(row.id) || typeof row.delete !== "boolean")) {
        throw new Error("Every response row needs a valid id and boolean delete value.");
      }
      const outputIds = rows.map((row) => row.id);
      if (new Set(outputIds).size !== outputIds.length || outputIds.length !== sourceIds.length || sourceIds.some((id) => !outputIds.includes(id))) {
        throw new Error("The response must contain every input id exactly once and no other ids.");
      }
      const currentById = new Map(groups.flat().map((row) => [row.id, row]));
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
      setPreview(normalizedRows);
      setConfirmOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const applyConfirmed = async () => {
    setBusy(true);
    setError(null);
    try {
      const applyResponse = await fetch("/api/words/concept-merge/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceGroups, output: preview }),
      });
      const result = (await applyResponse.json()) as {
        ok?: boolean;
        updated?: number;
        deleted?: number;
        error?: string;
      };
      if (!applyResponse.ok || !result.ok) throw new Error(result.error || "Could not apply concept merges.");
      setConfirmOpen(false);
      setResponse("");
      router.refresh();
      await createData(
        false,
        `Updated ${result.updated ?? 0} and deleted ${result.deleted ?? 0} Word record(s) ✓`,
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
      <button
        type="button"
        disabled={busy}
        aria-busy={busy && !open}
        onClick={() => void createData(true)}
        className="relative rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5"
      >
        MERGE WORD CONCEPTS <RemainingCountBadge count={remainingCount} />
        {busy && !open ? (
          <span className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-background/85" aria-hidden="true">
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current" />
          </span>
        ) : null}
        {busy && !open ? <span className="sr-only">Preparing</span> : null}
      </button>

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
                <b>Merge word concepts — Word</b>
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
                  <li>گروه باید حداقل دو رکورد <code>Word</code> داشته باشد.</li>
                  <li>حداقل یک رکورد گروه باید <code>conceptMergeReviewed=false</code> داشته باشد.</li>
                  <li>گروهی که تمام رکوردهایش بررسی شده‌اند دوباره به پرامپت ارسال نمی‌شود.</li>
                  <li><code>Count = 0</code> یعنی تمام گروه‌های واجد شرایط.</li>
                </ul>
                <div className="mt-2 font-semibold">پس از تأیید چه تغییری می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li>در هر مفهوم ادغام‌شده، قدیمی‌ترین Word باقی می‌ماند و <code>meaningId</code>، <code>otherMeaningIds</code> و <code>concept_explained_fa</code> آن با نتیجهٔ نهایی به‌روزرسانی می‌شوند.</li>
                  <li>تمام جمله‌های معتبر گروه بدون تکرار در <code>sentenceIds</code> رکورد باقی‌مانده جمع می‌شوند و ترتیب آن‌ها حفظ می‌شود.</li>
                  <li>Wordهای جدیدترِ ادغام‌شده حذف می‌شوند، اما رکوردهای Sentence و PersianWord حذف نمی‌شوند.</li>
                  <li>ارجاع به Wordهای حذف‌شده از <code>synonymIds</code> و <code>comparedMeaningWordIds</code> سایر رکوردها پاک می‌شود.</li>
                  <li>گروه تک‌رکوردی به مدل فرستاده نمی‌شود و فقط بررسی‌شده علامت می‌خورد.</li>
                  <li>هیچ ستون دیتابیس حذف نمی‌شود؛ فقط مقدارهای بالا تغییر می‌کنند و ردیف‌های Word اضافه حذف می‌شوند.</li>
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
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs">
                    Count
                    <input type="number" min="0" value={limit} disabled={busy} onChange={(event) => setLimit(event.target.value)} className="ml-2 w-20 rounded border px-2 py-1" />
                  </label>
                  <button type="button" disabled={busy} onClick={() => void createData(false)} className={buttonClass}>
                    {busy ? "Creating…" : "Create data"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || groups.length === 0}
                    onClick={() => void navigator.clipboard.writeText(copyText).then(() => setNotice("Prompt and grouped data copied ✓")).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Copy all</button>
                  <RemainingCountButton
                    count={totalGroups}
                    disabled={busy}
                    onClick={() => setLimit(String(totalGroups))}
                  />
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
                  <button type="button" disabled={busy || !response.trim()} onClick={parseForPreview} className={`${buttonClass} flex-1`}>
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
    </>
  );
}
