"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { PromptBatchControls } from "@/components/prompts/PromptBatchControls.client";
import { RemainingCountButton, RemainingGroupRecordBadge } from "@/components/remaining-count";
import { completeAgentArtifact, usePendingAgentArtifact } from "@/lib/words/wordsTableAgentWorkflow.client";

const PROMPT_PATH = "src/prompts/word-extraction/merge_inflected_forms/rulseV1.md";

type SourceWordSense = {
  wordId: number;
  englishWordId: number;
  baseForm: string;
  pos: string;
  meaningFa: string;
  otherMeaningsFa: string[];
  conceptExplainedFa: string;
  sentences: Array<{ sentenceId: number; sentenceEn: string; sentenceEnMeaningFa: string }>;
};

type SourceGroup = {
  groupKey: string;
  pos: string;
  englishWords: Array<{ englishWordId: number; baseForm: string; words: SourceWordSense[] }>;
};

type SourceFingerprint = {
  groupKey: string;
  pos: string;
  englishWordIds: number[];
  wordIds: number[];
};

type OutputEntry = {
  canonicalEnglishWordId: number;
  canonicalForm: string;
  keepWordId: number;
  deleteWordIds: number[];
};

type OutputGroup = { groupKey: string; pos: string; entries: OutputEntry[] };

const buttonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parsePreview(value: string, groups: SourceGroup[]): OutputGroup[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== groups.length) {
    throw new Error("Response must contain exactly one output group for every loaded candidate group.");
  }
  return parsed.map((raw, groupIndex) => {
    if (!raw || typeof raw !== "object") throw new Error(`Output group ${groupIndex + 1} must be an object.`);
    const group = raw as Record<string, unknown>;
    const source = groups[groupIndex];
    if (group.groupKey !== source.groupKey || group.pos !== source.pos || !Array.isArray(group.entries) || !group.entries.length) {
      throw new Error(`Output group ${groupIndex + 1} does not match its input group.`);
    }
    const entries = group.entries as OutputEntry[];
    const sourceWordIds = source.englishWords.flatMap((word) => word.words.map((row) => row.wordId));
    const outputWordIds: number[] = [];
    for (const [entryIndex, entry] of entries.entries()) {
      if (!entry || typeof entry !== "object" || !positiveId(entry.canonicalEnglishWordId) ||
          typeof entry.canonicalForm !== "string" || !entry.canonicalForm.trim() || !positiveId(entry.keepWordId) ||
          !Array.isArray(entry.deleteWordIds) || entry.deleteWordIds.some((id) => !positiveId(id)) ||
          new Set(entry.deleteWordIds).size !== entry.deleteWordIds.length || entry.deleteWordIds.includes(entry.keepWordId)) {
        throw new Error(`Entry ${entryIndex + 1} in ${source.groupKey} has an invalid shape.`);
      }
      const canonical = source.englishWords.find((word) => word.englishWordId === entry.canonicalEnglishWordId);
      if (!canonical || canonical.baseForm !== entry.canonicalForm) {
        throw new Error(`Canonical EnglishWord in entry ${entryIndex + 1} of ${source.groupKey} is invalid.`);
      }
      const clusterIds = [entry.keepWordId, ...entry.deleteWordIds];
      if (Math.min(...clusterIds) !== entry.keepWordId) {
        throw new Error(`WordSense ${entry.keepWordId} is not the oldest WordSense in its entry.`);
      }
      outputWordIds.push(...clusterIds);
    }
    if (outputWordIds.length !== sourceWordIds.length || new Set(outputWordIds).size !== outputWordIds.length ||
        sourceWordIds.some((id) => !outputWordIds.includes(id))) {
      throw new Error(`Every WordSense in ${source.groupKey} must appear exactly once.`);
    }
    return { groupKey: source.groupKey, pos: source.pos, entries };
  });
}

export default function WordSenseInflectionMerge({
  remainingGroupCount,
  remainingRecordCount,
}: {
  remainingGroupCount: number;
  remainingRecordCount: number;
}) {
  const router = useRouter();
  const pendingAgent = usePendingAgentArtifact("merge_inflected_forms");
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(String(remainingGroupCount));
  const [prompt, setPrompt] = useState("");
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [sourceGroups, setSourceGroups] = useState<SourceFingerprint[]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<OutputGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setLimit(String(remainingGroupCount)), [remainingGroupCount]);
  const clearLoadedBatch = () => {
    setGroups([]);
    setSourceGroups([]);
    setResponse("");
    setPreview([]);
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
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent(PROMPT_PATH)}`),
        fetch("/api/words/inflection-merge/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: parsedLimit }),
        }),
      ]);
      const promptJson = (await promptResponse.json()) as { text?: string; error?: string };
      const dataJson = (await dataResponse.json()) as {
        ok?: boolean;
        items?: SourceGroup[];
        sourceGroups?: SourceFingerprint[];
        totalEligibleGroups?: number;
        error?: string;
      };
      if (!promptResponse.ok || typeof promptJson.text !== "string") {
        throw new Error(promptJson.error || "Could not load the inflection prompt.");
      }
      if (!dataResponse.ok || !dataJson.ok || !Array.isArray(dataJson.items) || !Array.isArray(dataJson.sourceGroups)) {
        throw new Error(dataJson.error || "Could not prepare inflection candidates.");
      }
      setPrompt(promptJson.text);
      setGroups(dataJson.items);
      setSourceGroups(dataJson.sourceGroups);
      setTotalGroups(dataJson.totalEligibleGroups ?? dataJson.items.length);
      setResponse("");
      setPreview([]);
      setNotice(successNotice ?? `Created data with ${dataJson.items.length} POS-separated inflection group(s) ✓`);
      if (showModal) setOpen(true);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (responseValue = response) => {
    setBusy(true);
    setError(null);
    try {
      const value = JSON.parse(responseValue) as unknown;
      const recordsResponse = await fetch("/api/words/inflection-merge/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: value }),
      });
      const recordsJson = (await recordsResponse.json()) as {
        ok?: boolean;
        output?: OutputGroup[];
        items?: SourceGroup[];
        sourceGroups?: SourceFingerprint[];
        error?: string;
      };
      if (!recordsResponse.ok || !recordsJson.ok || !Array.isArray(recordsJson.output) ||
          !Array.isArray(recordsJson.items) || !Array.isArray(recordsJson.sourceGroups)) {
        throw new Error(recordsJson.error || "Could not rebuild inflection groups from this response.");
      }
      const parsed = parsePreview(JSON.stringify(recordsJson.output), recordsJson.items);
      setGroups(recordsJson.items);
      setSourceGroups(recordsJson.sourceGroups);
      setTotalGroups(recordsJson.items.length);
      setPreview(parsed);
      setNotice(`Rebuilt and validated ${recordsJson.sourceGroups.length} current group(s) from the response IDs ✓`);
      setConfirmOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const applyConfirmed = async () => {
    setBusy(true);
    setError(null);
    try {
      const applyResponse = await fetch("/api/words/inflection-merge/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceGroups, output: preview }),
      });
      const result = (await applyResponse.json()) as {
        ok?: boolean;
        updated?: number;
        deleted?: number;
        deletedEnglishWords?: number;
        savedForms?: number;
        failedAudioFiles?: number;
        error?: string;
      };
      if (!applyResponse.ok || !result.ok) throw new Error(result.error || "Could not apply inflection merges.");
      if (agentRunId) {
        await completeAgentArtifact(agentRunId);
        setAgentRunId(null);
        await pendingAgent.refresh();
      }
      setConfirmOpen(false);
      setResponse("");
      router.refresh();
      await createData(
        false,
        `Kept ${result.updated ?? 0}, deleted ${result.deleted ?? 0} WordSense and ${result.deletedEnglishWords ?? 0} empty EnglishWord record(s), and saved ${result.savedForms ?? 0} confirmed form(s)${result.failedAudioFiles ? `; ${result.failedAudioFiles} audio cleanup(s) failed` : ""} ✓`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const sourceWordById = new Map(groups.flatMap((group) =>
    group.englishWords.flatMap((word) => word.words.map((row) => [row.wordId, row] as const)),
  ));
  const copyText = `${prompt}\n\n${JSON.stringify(groups, null, 2)}`;
  const totalDeleted = preview.flatMap((group) => group.entries).reduce((sum, entry) => sum + entry.deleteWordIds.length, 0);
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
      await openPreview(savedResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-busy={busy && !open}
        onClick={() => void openStage()}
        className="relative rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5"
      >
        3. MERGE INFLECTED FORMS <RemainingGroupRecordBadge groupCount={remainingGroupCount} recordCount={remainingRecordCount} />
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
                <b>Merge inflected forms — WordSense</b>
                <div className="text-xs opacity-70">
                  Copy the prompt and POS-separated data to an external AI, paste JSON here, preview every deletion, then confirm.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  dir="rtl"
                  aria-expanded={showGuide}
                  aria-controls="word-inflection-merge-guide"
                  onClick={() => setShowGuide((current) => !current)}
                  className={buttonClass}
                >
                  راهنمای انتخاب و تغییر داده‌ها
                </button>
                <PromptSourcesButton paths={[PROMPT_PATH]} />
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className={buttonClass}>Close</button>
              </div>
            </div>

            {showGuide ? (
              <div
                id="word-inflection-merge-guide"
                dir="rtl"
                className="max-h-72 overflow-auto rounded border border-blue-500/30 bg-blue-500/10 p-3 text-right text-sm leading-6"
              >
                <div className="font-semibold">هدف این مرحله</div>
                <p>
                  جمع‌های قانونمند اسم با <span dir="ltr">s/es</span> و شکل‌های قانونمند فعل با <span dir="ltr">ing/ed</span> که همان مفهوم آموزشی را تکرار می‌کنند شناسایی می‌شوند. قدیمی‌ترین WordSense باقی می‌ماند، اطلاعات ضروری روی آن جمع می‌شود و WordSenseهای تکراری فقط پس از تأیید شما حذف می‌شوند.
                </p>
                <div className="mt-2 font-semibold">چگونه candidateها ساخته می‌شوند؟</div>
                <ul className="list-disc pr-5">
                  <li>برنامه قواعد جمع <span dir="ltr">s/es/ies</span> را فقط برای WordSenseهای اسم و قواعد <span dir="ltr">ing/ed</span> را فقط برای WordSenseهای فعل اجرا می‌کند؛ تصمیم نهایی با پاسخ AI بیرونی است.</li>
                  <li>گروه‌ها از ابتدا بر اساس <code>pos</code> ساخته می‌شوند و معنی فارسی، توضیح مفهوم و متن جمله‌ها نیز برای جلوگیری از حذف اشتباه فرستاده می‌شوند.</li>
                  <li>افعال و جمع‌های بی‌قاعده، comparative/superlative و خانواده‌های اشتقاقی در این مرحله بررسی نمی‌شوند.</li>
                  <li>Count تعداد گروه‌هایی را تعیین می‌کند که در دادهٔ پرامپت قرار می‌گیرند.</li>
                </ul>
                <div className="mt-2 font-semibold">پاسخ AI چه چیزی تعیین می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li>فرم اصلی انگلیسی و EnglishWord مقصد برای هر مفهوم؛</li>
                  <li>قدیمی‌ترین WordSenseی که باید باقی بماند؛</li>
                  <li>WordSenseهای جدیدتری که دقیقاً همان مفهوم را در شکل صرفی دیگر تکرار کرده‌اند؛</li>
                  <li>مفهوم‌های مستقلی که باید با <code>deleteWordIds: []</code> جدا بمانند.</li>
                </ul>
                <div className="mt-2 font-semibold">پس از تأیید چه تغییری می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li>تمام sentence IDها، معنی‌های معتبر و روابط WordSenseهای حذف‌شونده بدون تکرار روی keeper حفظ می‌شوند.</li>
                  <li>ارجاع‌های <code>synonymIds</code> و <code>comparedMeaningWordIds</code> از WordSense حذف‌شده به keeper منتقل می‌شوند.</li>
                  <li>WordSense تکراری، concept audio متعلق به آن و EnglishWord خالی‌شده همراه با فایل صوتی متعلق به آن حذف می‌شوند.</li>
                  <li>فرم‌های تأییدشده در جدول <code>EnglishWordForm</code> ذخیره می‌شوند؛ این جدول مفهوم آموزشی جدیدی ایجاد نمی‌کند.</li>
                  <li>WordSense از دیتابیس حذف می‌شود؛ Note متناظر در Anki تا اجرای ابزار موجودِ <span dir="ltr">Anki notes missing in DB</span> باقی می‌ماند و از همان‌جا قابل پاک‌سازی است.</li>
                </ul>
                <p className="mt-2 font-medium text-amber-800 dark:text-amber-300">
                  <span>نمونه: </span><span dir="ltr">building</span><span> به معنی «ساختمان» مستقل می‌ماند، ولی کاربرد فعلی فعل </span><span dir="ltr">build</span><span> می‌تواند با WordSense فعل ادغام شود.</span>
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
                  <RemainingCountButton count={totalGroups} disabled={busy} onClick={() => setLimit(String(totalGroups))} />
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
                  placeholder='[{"groupKey":"noun:21,44","pos":"noun","entries":[{"canonicalEnglishWordId":44,"canonicalForm":"shoes","keepWordId":81,"deleteWordIds":[120]}]}]'
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void navigator.clipboard.readText().then(setResponse).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Paste response</button>
                  <button type="button" disabled={busy || !response.trim()} onClick={() => void openPreview()} className={`${buttonClass} flex-1`}>
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
          <div className="flex h-[90vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Confirm inflection merges</b>
                <div className="text-xs opacity-70">Review every keeper, canonical form and permanent WordSense deletion. Final validation runs again in one database transaction.</div>
              </div>
              <button type="button" disabled={busy} onClick={() => setConfirmOpen(false)} className={buttonClass}>Back without saving</button>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            <div className="min-h-0 flex-1 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-3 py-2">group / POS</th>
                    <th className="px-3 py-2">canonical EnglishWord</th>
                    <th className="px-3 py-2">keeper WordSense</th>
                    <th className="px-3 py-2">WordSense records deleted after merge</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.flatMap((group) => group.entries.map((entry, entryIndex) => {
                    const keeper = sourceWordById.get(entry.keepWordId);
                    const alternateForms = [...new Set(
                      [entry.keepWordId, ...entry.deleteWordIds]
                        .map((id) => sourceWordById.get(id)?.baseForm)
                        .filter((form): form is string => Boolean(form) && form !== entry.canonicalForm),
                    )];
                    return (
                      <tr key={`${group.groupKey}:${entry.keepWordId}`} className="border-b align-top">
                        <td className="px-3 py-2 font-mono">{entryIndex === 0 ? <>{group.groupKey}<br />{group.pos}</> : "↳"}</td>
                        <td className="bg-blue-500/10 px-3 py-2">
                          <b>{entry.canonicalForm}</b><br />
                          <span className="font-mono">EnglishWord {entry.canonicalEnglishWordId}</span>
                          {alternateForms.length ? <><br /><span>Save form(s): </span><span dir="ltr">{alternateForms.join(", ")}</span></> : null}
                        </td>
                        <td className="bg-emerald-500/10 px-3 py-2">
                          <b>KEEP WordSense {entry.keepWordId}</b><br />
                          <span dir="ltr">{keeper?.baseForm ?? "Unknown"}</span>
                          {keeper?.meaningFa ? <><br /><span dir="rtl">{keeper.meaningFa}</span></> : null}
                        </td>
                        <td className={entry.deleteWordIds.length ? "bg-red-500/10 px-3 py-2" : "px-3 py-2 opacity-70"}>
                          {entry.deleteWordIds.length ? entry.deleteWordIds.map((id) => {
                            const row = sourceWordById.get(id);
                            return <div key={id}><b>DELETE WordSense {id}</b> — <span dir="ltr">{row?.baseForm ?? "Unknown"}</span>{row?.meaningFa ? <> — <span dir="rtl">{row.meaningFa}</span></> : null}</div>;
                          }) : "Keep as an independent concept"}
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Keep {preview.flatMap((group) => group.entries).length} • Permanently delete {totalDeleted} WordSense record(s)</span>
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
