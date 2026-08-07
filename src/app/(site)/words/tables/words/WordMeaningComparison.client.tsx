"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  persianWordId: number;
  shared_persian_meaning: string;
  records: SourceRecord[];
};

type OutputRecord = {
  id: number;
  concept_explained_fa: string;
  synonymIds: number[];
};

type OutputGroup = {
  persianWordId: number;
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
    if (group.persianWordId !== source.persianWordId || !Array.isArray(group.records) ||
        group.records.length !== source.records.length) {
      throw new Error(`Output group ${groupIndex + 1} does not match its input group.`);
    }
    const records = group.records as OutputRecord[];
    if (records.some((record, recordIndex) =>
      !record || typeof record !== "object" || record.id !== source.records[recordIndex].id ||
      typeof record.concept_explained_fa !== "string" || !record.concept_explained_fa.trim() ||
      !Array.isArray(record.synonymIds)
    )) throw new Error(`Output records for PersianWord ${source.persianWordId} do not match the input order.`);
    return { persianWordId: source.persianWordId, records };
  });
}

export default function WordMeaningComparison() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [busyGroupId, setBusyGroupId] = useState<number | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState("0");
  const [prompt, setPrompt] = useState("");
  const [groups, setGroups] = useState<SourceGroup[]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [response, setResponse] = useState("");
  const [outputs, setOutputs] = useState<OutputGroup[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const createData = async (showModal: boolean) => {
    const parsedLimit = Number(limit);
    if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 0) {
      setError("Group count must be a non-negative integer; 0 means all groups.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [promptResponse, dataResponse] = await Promise.all([
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent("src/prompts/word-extraction/compare_word_meanings/rulseV1.md")}`),
        fetch("/api/words/meaning-comparison/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: parsedLimit }),
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
      setNotice(`Created ${dataJson.items.length} candidate group(s) ✓`);
      if (showModal) setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const openReview = async () => {
    setError(null);
    setLoading(true);
    try {
      const rawOutput = JSON.parse(response) as unknown;
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
      const parsed = parseResponse(response, recordsJson.items);
      setGroups(recordsJson.items);
      setTotalGroups(recordsJson.items.length);
      setOutputs(parsed);
      setDrafts(Object.fromEntries(parsed.map((group) => [group.persianWordId, JSON.stringify(group, null, 2)])));
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
    const parsed = parseResponse(`[${drafts[source.persianWordId] ?? ""}]`, [source]);
    const applyResponse = await fetch("/api/words/meaning-comparison/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persianWordId: source.persianWordId,
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
    setBusyGroupId(source.persianWordId);
    try {
      const updated = await applyGroup(source);
      setConfirmed((current) => new Set([...current, source.persianWordId]));
      setNotice(`Confirmed PersianWord ${source.persianWordId}; updated ${updated} Word record(s) ✓`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyGroupId(null);
    }
  };

  const confirmAllGroups = async () => {
    const pending = groups.filter((group) => !confirmed.has(group.persianWordId));
    if (!pending.length) return;
    setError(null);
    setApplyingAll(true);
    let confirmedCount = 0;
    let updatedCount = 0;
    try {
      for (const source of pending) {
        setBusyGroupId(source.persianWordId);
        updatedCount += await applyGroup(source);
        confirmedCount += 1;
        setConfirmed((current) => new Set([...current, source.persianWordId]));
      }
      setNotice(`Confirmed all ${confirmedCount} remaining group(s); updated ${updatedCount} Word record(s) ✓`);
      router.refresh();
    } catch (reason) {
      setError(
        `Stopped after confirming ${confirmedCount} group(s): ${reason instanceof Error ? reason.message : String(reason)}`,
      );
      if (confirmedCount > 0) router.refresh();
    } finally {
      setBusyGroupId(null);
      setApplyingAll(false);
    }
  };

  const copyText = `${prompt}\n\n${JSON.stringify(groups, null, 2)}`;
  const outputByPersianId = new Map(outputs.map((group) => [group.persianWordId, group]));

  return (
    <>
      <button type="button" disabled={loading} onClick={() => void createData(true)} className={buttonClass}>
        {loading && !open ? "PREPARING…" : "COMPARE WORD MEANINGS"}
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
                <b>Compare word meanings — Word</b>
                <div className="text-xs opacity-70">
                  Groups share a PersianWord meaning. Database fields change only after each group is reviewed and confirmed.
                </div>
              </div>
              <button type="button" disabled={loading} onClick={() => setOpen(false)} className={buttonClass}>Close</button>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs">
                    Group count
                    <input type="number" min="0" value={limit} disabled={loading} onChange={(event) => setLimit(event.target.value)} className="ml-2 w-20 rounded border px-2 py-1" />
                  </label>
                  <button type="button" disabled={loading} onClick={() => void createData(false)} className={buttonClass}>
                    {loading ? "Creating…" : "Create data"}
                  </button>
                  <button
                    type="button"
                    disabled={loading || groups.length === 0}
                    onClick={() => void navigator.clipboard.writeText(copyText).then(() => setNotice("Prompt and grouped data copied ✓")).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))}
                    className={buttonClass}
                  >Copy all</button>
                  <span className="text-xs font-semibold text-amber-700">Eligible groups: {totalGroups}</span>
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
                  placeholder='[{"persianWordId":123,"records":[{"id":10,"concept_explained_fa":"...","synonymIds":[11]}]}]'
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
                  disabled={busyGroupId !== null || confirmed.size === groups.length}
                  onClick={() => void confirmAllGroups()}
                  className={buttonClass}
                >{applyingAll ? "CONFIRMING ALL…" : "CONFIRM ALL GROUPS"}</button>
                <button type="button" disabled={busyGroupId !== null} onClick={() => setReviewOpen(false)} className={buttonClass}>Back without further changes</button>
              </div>
            </div>
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}
            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}
            <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
              {groups.map((source, index) => {
                const isConfirmed = confirmed.has(source.persianWordId);
                return (
                  <section key={source.persianWordId} className={`rounded-xl border p-4 ${isConfirmed ? "border-emerald-500/50 bg-emerald-500/10" : ""}`}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Group {index + 1} • PersianWord {source.persianWordId} • {source.shared_persian_meaning}</div>
                      <button
                        type="button"
                        disabled={busyGroupId !== null || isConfirmed}
                        onClick={() => void confirmGroup(source)}
                        className={buttonClass}
                      >{isConfirmed ? "CONFIRMED ✓" : busyGroupId === source.persianWordId ? "APPLYING…" : "CONFIRM THIS GROUP"}</button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold opacity-70">Current records</div>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded border p-3 font-mono text-xs">{JSON.stringify(source, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold opacity-70">Proposed values (editable JSON)</div>
                        <textarea
                          value={drafts[source.persianWordId] ?? JSON.stringify(outputByPersianId.get(source.persianWordId), null, 2)}
                          disabled={busyGroupId !== null || isConfirmed}
                          onChange={(event) => setDrafts((current) => ({ ...current, [source.persianWordId]: event.target.value }))}
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
