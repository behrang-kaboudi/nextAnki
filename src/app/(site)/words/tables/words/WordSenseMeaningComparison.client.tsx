"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { PromptBatchControls } from "@/components/prompts/PromptBatchControls.client";
import { RemainingCountButton, RemainingGroupRecordBadge } from "@/components/remaining-count";
import { completeAgentArtifact, usePendingAgentArtifact } from "@/lib/words/wordsTableAgentWorkflow.client";

const PROMPT_PATH = "src/prompts/word-extraction/compare_word_meanings/rulseV1.md";

type SourceRecord = {
  id: number;
  word: string;
  pos: string;
  meaning_fa: string;
  other_meanings_fa: string[];
  concept_explained_fa: string;
  synonymIds: number[];
};

type SourceGroup = {
  groupKey: string;
  persianWordId: number;
  pos: string;
  shared_persian_meaning: string;
  records: SourceRecord[];
};

type OutputRecord = {
  id: number;
  concept_explained_fa: string;
  synonymIds: number[];
};

type OutputGroup = {
  groupKey: string;
  persianWordId: number;
  pos: string;
  records: OutputRecord[];
};

const buttonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

function parseResponse(value: string, sourceGroups: SourceGroup[]): OutputGroup[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== sourceGroups.length) {
    throw new Error("Response must contain exactly one output item for every loaded candidate group.");
  }
  return parsed.map((raw, groupIndex) => {
    if (!raw || typeof raw !== "object") throw new Error("Every output group must be an object.");
    const group = raw as Record<string, unknown>;
    const source = sourceGroups[groupIndex];
    if (group.groupKey !== source.groupKey || group.persianWordId !== source.persianWordId ||
        group.pos !== source.pos || !Array.isArray(group.records) ||
        group.records.length !== source.records.length) {
      throw new Error(`Output group ${groupIndex + 1} does not match its input group.`);
    }
    const records = group.records as OutputRecord[];
    if (records.some((record, recordIndex) =>
      !record || typeof record !== "object" || record.id !== source.records[recordIndex].id ||
      typeof record.concept_explained_fa !== "string" || !record.concept_explained_fa.trim() ||
      !Array.isArray(record.synonymIds)
    )) throw new Error(`Output records for PersianWord ${source.persianWordId} do not match the input order.`);
    return {
      groupKey: source.groupKey,
      persianWordId: source.persianWordId,
      pos: source.pos,
      records,
    };
  });
}

export default function WordSenseMeaningComparison({
  remainingGroupCount,
  remainingRecordCount,
}: {
  remainingGroupCount: number;
  remainingRecordCount: number;
}) {
  const router = useRouter();
  const pendingAgent = usePendingAgentArtifact("compare_word_meanings");
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busyGroupKey, setBusyGroupKey] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(String(remainingGroupCount));
  const [prompt, setPrompt] = useState("");
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [response, setResponse] = useState("");
  const [outputs, setOutputs] = useState<OutputGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setLimit(String(remainingGroupCount)), [remainingGroupCount]);
  const clearLoadedBatch = () => {
    setGroups([]);
    setResponse("");
    setOutputs([]);
    setDrafts({});
    setConfirmed(new Set());
    setNotice(null);
  };

  const createData = async (showModal: boolean) => {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 0) {
      setError("Count must be a non-negative integer.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [promptResponse, dataResponse] = await Promise.all([
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent(PROMPT_PATH)}`),
        fetch("/api/words/meaning-comparison/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: parsedLimit }),
        }),
      ]);
      const promptJson = (await promptResponse.json()) as { text?: string; error?: string };
      const dataJson = (await dataResponse.json()) as {
        ok?: boolean;
        items?: SourceGroup[];
        totalEligibleGroups?: number;
        error?: string;
      };
      if (!promptResponse.ok || typeof promptJson.text !== "string") {
        throw new Error(promptJson.error || "Could not load the comparison prompt.");
      }
      if (!dataResponse.ok || !dataJson.ok || !Array.isArray(dataJson.items)) {
        throw new Error(dataJson.error || "Could not prepare candidate groups.");
      }
      setPrompt(promptJson.text);
      setGroups(dataJson.items);
      setTotalGroups(dataJson.totalEligibleGroups ?? dataJson.items.length);
      setResponse("");
      setOutputs([]);
      setDrafts({});
      setConfirmed(new Set());
      setNotice(`Created data with ${dataJson.items.length} candidate group(s) ✓`);
      if (showModal) setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const openReview = async (responseValue = response) => {
    setError(null);
    setLoading(true);
    try {
      const rawOutput = JSON.parse(responseValue) as unknown;
      const recordsResponse = await fetch("/api/words/meaning-comparison/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ output: rawOutput }),
      });
      const recordsJson = (await recordsResponse.json()) as {
        ok?: boolean;
        items?: SourceGroup[];
        error?: string;
      };
      if (!recordsResponse.ok || !recordsJson.ok || !Array.isArray(recordsJson.items)) {
        throw new Error(recordsJson.error || "Could not load the source groups from this response.");
      }
      const parsed = parseResponse(responseValue, recordsJson.items);
      setGroups(recordsJson.items);
      setTotalGroups(recordsJson.items.length);
      setOutputs(parsed);
      setDrafts(Object.fromEntries(parsed.map((group) => [group.groupKey, JSON.stringify(group, null, 2)])));
      setConfirmed(new Set());
      setNotice(`Loaded ${parsed.length} group(s) directly from the saved response ✓`);
      setReviewOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const applyGroup = async (source: SourceGroup) => {
    const parsed = parseResponse(`[${drafts[source.groupKey] ?? ""}]`, [source]);
    const applyResponse = await fetch("/api/words/meaning-comparison/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupKey: source.groupKey,
        persianWordId: source.persianWordId,
        pos: source.pos,
        sourceWordIds: source.records.map((record) => record.id),
        output: parsed,
      }),
    });
    const result = (await applyResponse.json()) as { ok?: boolean; updated?: number; error?: string };
    if (!applyResponse.ok || !result.ok) throw new Error(result.error || "Could not apply this comparison group.");
    return result.updated ?? 0;
  };

  const confirmGroup = async (source: SourceGroup) => {
    setError(null);
    setBusyGroupKey(source.groupKey);
    try {
      const updated = await applyGroup(source);
      const nextConfirmed = new Set([...confirmed, source.groupKey]);
      setConfirmed(nextConfirmed);
      if (agentRunId && nextConfirmed.size === groups.length) {
        await completeAgentArtifact(agentRunId);
        setAgentRunId(null);
        await pendingAgent.refresh();
      }
      setNotice(`Confirmed ${source.groupKey}; updated ${updated} WordSense record(s) ✓`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyGroupKey(null);
    }
  };

  const confirmAllGroups = async () => {
    const pending = groups.filter((group) => !confirmed.has(group.groupKey));
    if (!pending.length) return;
    setError(null);
    setApplyingAll(true);
    try {
      const output = pending.map((source) => (
        parseResponse(`[${drafts[source.groupKey] ?? ""}]`, [source])[0]
      ));
      const applyResponse = await fetch("/api/words/meaning-comparison/apply-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceGroups: pending.map((source) => ({
            groupKey: source.groupKey,
            persianWordId: source.persianWordId,
            pos: source.pos,
            sourceWordIds: source.records.map((record) => record.id),
          })),
          output,
        }),
      });
      const result = (await applyResponse.json()) as {
        ok?: boolean;
        confirmed?: number;
        updated?: number;
        error?: string;
      };
      if (!applyResponse.ok || !result.ok) {
        throw new Error(result.error || "Could not apply these comparison groups.");
      }
      setConfirmed((current) => new Set([
        ...current,
        ...pending.map((source) => source.groupKey),
      ]));
      if (agentRunId) {
        await completeAgentArtifact(agentRunId);
        setAgentRunId(null);
        await pendingAgent.refresh();
      }
      setNotice(`Confirmed all ${result.confirmed ?? pending.length} remaining group(s); updated ${result.updated ?? 0} WordSense record(s) ✓`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setApplyingAll(false);
    }
  };

  const copyText = `${prompt}\n\n${JSON.stringify(groups, null, 2)}`;
  const outputByGroupKey = new Map(outputs.map((group) => [group.groupKey, group]));
  const openStage = async () => {
    setLoading(true);
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
      await openReview(savedResponse);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={loading}
        aria-busy={loading && !open}
        onClick={() => void openStage()}
        className="relative rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-100 dark:hover:bg-white/5"
      >
        4. COMPARE WORD MEANINGS <RemainingGroupRecordBadge groupCount={remainingGroupCount} recordCount={remainingRecordCount} />
        {pendingAgent.artifact ? <span className="ml-1 text-emerald-700">AI response ready ✓</span> : null}
        {loading && !open ? (
          <span className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-background/85" aria-hidden="true">
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-current" />
          </span>
        ) : null}
        {loading && !open ? <span className="sr-only">Preparing</span> : null}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => event.target === event.currentTarget && !loading && setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Compare word meanings — WordSense</b>
                <div className="text-xs opacity-70">
                  Groups share a PersianWord meaning and part of speech. Database fields change only after each group is reviewed and confirmed.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  aria-expanded={showWorkflowGuide}
                  aria-controls="word-meaning-comparison-workflow-guide"
                  onClick={() => setShowWorkflowGuide((current) => !current)}
                  className={buttonClass}
                >
                  راهنمای انتخاب و تغییر داده‌ها
                </button>
                <PromptSourcesButton paths={[PROMPT_PATH]} />
                <button type="button" disabled={loading} onClick={() => setOpen(false)} className={buttonClass}>Close</button>
              </div>
            </div>
            {showWorkflowGuide ? (
              <div
                id="word-meaning-comparison-workflow-guide"
                dir="rtl"
                className="max-h-64 overflow-auto rounded border border-blue-500/30 bg-blue-500/10 p-3 text-right text-sm leading-6"
              >
                <div className="font-semibold">هدف این مرحله</div>
                <p>
                  رکوردهایی که حداقل یک معنی فارسی مشترک دارند با هم مقایسه
                  می‌شوند تا تفاوت مفهومشان روشن و رابطهٔ معنایی نزدیک میان آن‌ها ثبت شود.
                  این مرحله برای ترکیب یا حذف WordSenseها نیست.
                </p>
                <div className="mt-2 font-semibold">شرایط انتخاب رکوردها</div>
                <ul className="list-disc pr-5">
                  <li>هر ترکیب یکسان از معنی موجود در <code>meaningId</code> یا <code>otherMeaningIds</code> و <code>pos</code> یک گروه می‌سازد.</li>
                  <li>فقط گروه‌هایی انتخاب می‌شوند که آن معنی فارسی و نقش دستوری یکسان را دست‌کم دو WordSense استفاده کرده باشند.</li>
                  <li>گروهی که تمام اعضایش قبلاً یکدیگر را در <code>comparedMeaningWordIds</code> ثبت کرده‌اند دوباره نمایش داده نمی‌شود.</li>
                  <li>شناسهٔ PersianWord مشترک باید هنوز در دیتابیس موجود باشد و گروه در پاسخ دقیقاً با دادهٔ ورودی تطبیق کند.</li>
                </ul>
                <div className="mt-2 font-semibold">پس از تأیید چه تغییری می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li><code>concept_explained_fa</code> هر WordSense با توضیح نهایی و متمایزکننده به‌روزرسانی می‌شود.</li>
                  <li>WordSenseهای واقعاً نزدیک و قابل اشتباه به‌صورت دوطرفه در <code>synonymIds</code> ثبت می‌شوند.</li>
                  <li>تمام اعضای بررسی‌شده در <code>comparedMeaningWordIds</code> یکدیگر ثبت می‌شوند تا همان گروه دوباره پردازش نشود.</li>
                  <li>هیچ WordSense، Sentence، PersianWord یا ستونی حذف نمی‌شود و فیلدهای معنی و جمله تغییر نمی‌کنند.</li>
                </ul>
              </div>
            ) : null}
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-col gap-2">
                  <PromptBatchControls
                    batchSize={limit}
                    disabled={loading}
                    loadedCount={groups.length}
                    totalEligibleCount={totalGroups}
                    onBatchSizeChange={(value) => { clearLoadedBatch(); setLimit(value); }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                  <button type="button" disabled={loading} onClick={() => void createData(false)} className={buttonClass}>
                    {loading ? "Creating…" : "Create data"}
                  </button>
                  <button
                    type="button"
                    disabled={loading || groups.length === 0}
                    onClick={() => void navigator.clipboard.writeText(copyText).then(() => setNotice("Prompt and grouped data copied ✓")).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Copy prompt + data</button>
                  <RemainingCountButton
                    count={totalGroups}
                    disabled={loading}
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
                  disabled={loading}
                  onChange={(event) => setResponse(event.target.value)}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                  placeholder='[{"groupKey":"adjective:123","persianWordId":123,"pos":"adjective","records":[{"id":10,"concept_explained_fa":"...","synonymIds":[11]}]}]'
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void navigator.clipboard.readText().then(setResponse).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Paste response</button>
                  <button type="button" disabled={loading || !response.trim()} onClick={() => void openReview()} className={`${buttonClass} flex-1`}>
                    {loading ? "LOADING RESPONSE…" : "REVIEW GROUPS"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {reviewOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="flex h-[90vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <b>Human review — meaning comparison groups</b>
                <div className="text-xs opacity-70">Edit if needed, then confirm each group separately. Confirmation also marks every pair in that group as compared.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyGroupKey !== null || applyingAll || confirmed.size === groups.length}
                  onClick={() => void confirmAllGroups()}
                  className={buttonClass}
                >{applyingAll ? "CONFIRMING ALL…" : "CONFIRM ALL GROUPS"}</button>
                <button type="button" disabled={busyGroupKey !== null || applyingAll} onClick={() => setReviewOpen(false)} className={buttonClass}>Back without further changes</button>
              </div>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}
            <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
              {groups.map((source, index) => {
                const isConfirmed = confirmed.has(source.groupKey);
                return (
                  <section key={source.groupKey} className={`rounded-xl border p-4 ${isConfirmed ? "border-emerald-500/50 bg-emerald-500/10" : ""}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Group {index + 1} • {source.groupKey} • {source.shared_persian_meaning}</div>
                      <button
                        type="button"
                        disabled={busyGroupKey !== null || applyingAll || isConfirmed}
                        onClick={() => void confirmGroup(source)}
                        className={buttonClass}
                      >{isConfirmed ? "CONFIRMED ✓" : busyGroupKey === source.groupKey ? "APPLYING…" : "CONFIRM THIS GROUP"}</button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold opacity-70">Current records</div>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border p-3 font-mono text-xs">{JSON.stringify(source, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold opacity-70">Proposed values (editable JSON)</div>
                        <textarea
                          value={drafts[source.groupKey] ?? JSON.stringify(outputByGroupKey.get(source.groupKey), null, 2)}
                          disabled={busyGroupKey !== null || applyingAll || isConfirmed}
                          onChange={(event) => setDrafts((current) => ({ ...current, [source.groupKey]: event.target.value }))}
                          className="h-80 w-full rounded border p-3 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
