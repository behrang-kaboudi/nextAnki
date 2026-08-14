"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/icons/ActionIcon";
import { PromptSourcesButton } from "@/components/prompts/PromptSourcesButton";
import { RemainingCountBadge, RemainingCountButton } from "@/components/remaining-count";
import { BulkReviewStatusActions } from "@/components/review-status/BulkReviewStatusActions.client";

const PROMPT_PATHS = [
  "src/prompts/word-extraction/meaning_fa_review/rulseV1.md",
  "src/prompts/word-extraction/other_meanings_fa/rulseV1.md",
] as const;

type Correction = {
  id: number;
  meaning_fa?: string;
  other_meanings_fa?: string[];
  invalid_sentence_ids?: number[];
};
export default function WordSenseMeaningsReview({
  pendingCount,
}: {
  pendingCount: number;
}) {
  const r = useRouter(),
    [o, setO] = useState(false),
    [l, setL] = useState("0"),
    [d, setD] = useState(""),
    [prompt, setPrompt] = useState(""),
    [a, setA] = useState(""),
    [b, setB] = useState(false),
    [e, setE] = useState<string | null>(null),
    [remaining, setRemaining] = useState<number | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [showCloseHelp, setShowCloseHelp] = useState(false);
  const [showApplyAllHelp, setShowApplyAllHelp] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [applyAllConfirmOpen, setApplyAllConfirmOpen] = useState(false);
  const load = async () => {
    setB(true);
    setE(null);
    setNotice(null);
    try {
      const [promptResponses, x] = await Promise.all([
          Promise.all(PROMPT_PATHS.map(async (path) => {
            const response = await fetch(`/api/ai/prompt-file?path=${encodeURIComponent(path)}`);
            const json = (await response.json()) as { text?: string; error?: string };
            if (!response.ok || !json.text) throw new Error(json.error || `Could not load ${path}.`);
            return json.text;
          })),
          fetch(`/api/words/meanings-review?limit=${encodeURIComponent(l)}`),
        ]),
        j = (await x.json()) as {
          ok?: boolean;
          items?: unknown;
          totalUnconfirmed?: number;
          error?: string;
        };
      if (!x.ok || !j.ok) throw Error(j.error || "Could not create data.");
      setPrompt(promptResponses.join("\n\n"));
      setD(JSON.stringify(j.items, null, 2));
      setRemaining(
        typeof j.totalUnconfirmed === "number" ? j.totalUnconfirmed : null,
      );
      setNotice("Data created ✓");
    } catch (x) {
      setE(x instanceof Error ? x.message : String(x));
    } finally {
      setB(false);
    }
  };
  const apply = async () => {
    setB(true);
    setE(null);
    setNotice(null);
    try {
      const c = JSON.parse(a) as unknown;
      if (!Array.isArray(c)) throw Error("Response must be a JSON array.");
      const parsed = c as Correction[];
      if (
        parsed.some(
          (item) =>
            !item ||
            typeof item !== "object" ||
            typeof item.id !== "number" ||
            !Number.isSafeInteger(item.id) ||
            item.id <= 0,
        )
      )
        throw Error("Response contains an invalid record.");
      if (!d || JSON.parse(d).length === 0) {
        const recordsResponse = await fetch(
          "/api/words/meanings-review/records",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: parsed.map((item) => item.id) }),
          },
        );
        const recordsJson = (await recordsResponse.json()) as {
          ok?: boolean;
          items?: unknown;
          error?: string;
        };
        if (!recordsResponse.ok || !recordsJson.ok)
          throw Error(recordsJson.error || "Could not load current records.");
        setD(JSON.stringify(recordsJson.items ?? [], null, 2));
      }
      setCorrections(parsed);
      setDrafts(
        Object.fromEntries(
          parsed.map((item) => [item.id, JSON.stringify(item, null, 2)]),
        ),
      );
      setConfirmedIds(new Set());
      setConfirmOpen(true);
    } catch (x) {
      setE(x instanceof Error ? x.message : String(x));
    } finally {
      setB(false);
    }
  };
  const commit = async (ids: number[], nextCorrections: Correction[]) => {
    setB(true);
    setE(null);
    try {
      const x = await fetch("/api/words/meanings-review/update-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, corrections: nextCorrections }),
        }),
        j = await x.json();
      if (!x.ok || !j.ok) throw Error(j.error || "Could not apply review.");
      setNotice(`Updated ${j.updated}/${j.total} ✓`);
      r.refresh();
      setConfirmedIds((current) => new Set([...current, ...ids]));
      if (ids.length > 1) setA("");
      return true;
    } catch (x) {
      setE(x instanceof Error ? x.message : String(x));
      return false;
    } finally {
      setB(false);
    }
  };
  const closeAndConfirm = async () => {
    const ids = ((d ? JSON.parse(d) : []) as Array<{ id: number }>).map(
      (item) => item.id,
    );
    const targetIds = ids.length ? ids : corrections.map((item) => item.id);
    const confirmedCorrections = corrections.filter((item) =>
      confirmedIds.has(item.id),
    );
    if (!targetIds.length || (await commit(targetIds, confirmedCorrections))) {
      setConfirmOpen(false);
      await load();
    }
  };
  const confirmOne = async (id: number) => {
    try {
      const draft = JSON.parse(drafts[id] ?? "") as Correction;
      if (!draft || typeof draft !== "object" || draft.id !== id) {
        throw new Error("The new value must be valid JSON with the same id.");
      }
      setCorrections((current) =>
        current.map((item) => (item.id === id ? draft : item)),
      );
      await commit([id], [draft]);
    } catch (error) {
      setE(error instanceof Error ? error.message : String(error));
    }
  };
  const copyAll = () =>
    void navigator.clipboard
      .writeText(`${prompt}\n\n${d}`)
      .then(() => setNotice("Prompt and data copied ✓"))
      .catch((reason) =>
        setE(reason instanceof Error ? reason.message : String(reason)),
      );
  return (
    <>
      <div className="inline-flex items-start gap-1">
        <button
          type="button"
          onClick={() => {
            setO(true);
            void load();
          }}
          disabled={b}
          className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          REVIEW PERSIAN MEANINGS <RemainingCountBadge count={pendingCount} />
        </button>
        <BulkReviewStatusActions
          pendingCount={pendingCount}
          pendingUnit="رکورد در انتظار"
          confirmEndpoint="/api/words/meanings-review/confirm-all"
          resetEndpoint="/api/words/meanings-review/reset-confirmed"
          confirmSubject="معانی فارسی"
          confirmWarning="این کار فقط وضعیت مرور را تأیید می‌کند و مقدار معنا، دیگرمعنا یا جمله را تغییر نمی‌دهد."
          resetSubject="مرورهای معانی فارسی"
          resetWarning="تمام رکوردهای تأییدشده دوباره Pending می‌شوند. هیچ معنا، دیگرمعنا یا جمله‌ای تغییر نمی‌کند."
          resetHelpLabel="About reset meanings review"
          resetHelpText="Sets all reviewed Persian meanings back to pending. Confirmation is required."
        />
      </div>
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
                  Only corrections are returned; Apply confirms all loaded rows.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
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
                  معنی فارسی هر رکورد و تعلق جمله‌ها به همان معنی بررسی می‌شود.
                  این مرحله رکوردهای تکراری را با هم ترکیب یا حذف نمی‌کند.
                </p>
                <div className="mt-2 font-semibold">شرایط انتخاب رکوردها</div>
                <ul className="list-disc pr-5">
                  <li>فقط رکوردهایی انتخاب می‌شوند که هنوز <code>meanings_confirmed=false</code> دارند.</li>
                  <li>رکوردها از شناسهٔ قدیمی‌تر به جدیدتر و به تعداد واردشده در Count خوانده می‌شوند؛ در این مرحله Count صفر یعنی هیچ رکوردی.</li>
                  <li>همهٔ جمله‌های موجود در آرایهٔ <code>sentenceIds</code> برای بررسی به مدل نشان داده می‌شوند.</li>
                </ul>
                <div className="mt-2 font-semibold">پس از تأیید چه تغییری می‌کند؟</div>
                <ul className="list-disc pr-5">
                  <li>در صورت پیشنهاد اصلاح، <code>meaningId</code> و <code>otherMeaningIds</code> با معنی‌های نهایی جایگزین می‌شوند.</li>
                  <li>شناسهٔ جمله‌هایی که مدل نامعتبر اعلام کرده از آرایهٔ <code>sentenceIds</code> حذف می‌شود.</li>
                  <li>رکوردهای تأییدشده <code>meanings_confirmed=true</code> می‌گیرند.</li>
                  <li>اولین شناسهٔ آرایه، یعنی <code>sentenceIds[0]</code>، جملهٔ اصلی WordSense برای فیلدها و صدای کارت Anki است.</li>
                  <li>هیچ رکورد WordSense، Sentence یا PersianWord و هیچ ستون دیتابیس در این مرحله حذف نمی‌شود.</li>
                </ul>
              </div>
            ) : null}
            {e ? <div className="text-red-600">{e}</div> : null}
            {notice ? (
              <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">
                {notice}
              </div>
            ) : null}
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <section className="flex min-h-0 flex-col gap-2">
                <div>
                  <label className="text-xs">
                    Count{" "}
                    <input
                      type="number"
                      min="0"
                      value={l}
                      disabled={b}
                      onChange={(x) => setL(x.target.value)}
                      className="ml-1 w-20 rounded border px-2 py-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={b}
                    className="ml-2 rounded border px-2 py-1 text-xs transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    {b ? "Loading…" : "Create data"}
                  </button>
                  <PromptSourcesButton paths={PROMPT_PATHS} />
                  <button
                    type="button"
                    onClick={copyAll}
                    disabled={b || !d}
                    className="ml-2 rounded border px-2 py-1 text-xs transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    Copy all
                  </button>
                  {remaining !== null ? (
                    <RemainingCountButton
                      count={remaining}
                      disabled={b}
                      onClick={() => setL(String(remaining))}
                    />
                  ) : null}
                </div>
                <textarea
                  readOnly
                  value={`${prompt}\n\n${d}`}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                />
              </section>
              <section className="flex min-h-0 flex-col gap-2">
                <b>Response JSON</b>
                <textarea
                  value={a}
                  disabled={b}
                  onChange={(x) => setA(x.target.value)}
                  className="min-h-0 flex-1 rounded border p-3 font-mono text-xs"
                  placeholder='[{"id":1,"meaning_fa":"...","other_meanings_fa":[],"invalid_sentence_ids":[12]}]'
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="flex h-[85vh] w-full max-w-6xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex justify-between">
              <div>
                <b>Confirm meaning updates</b>
                <div className="text-xs opacity-70">
                  Compare old and new values, edit the new JSON if needed, then
                  confirm each record.
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
                  MARK ALL AS REVIEWED AND CLOSE
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
                    این دکمه تمام رکوردهای batch را فقط به‌عنوان مرورشده ثبت
                    می‌کند (<code>meanings_confirmed=true</code>). تغییرات
                    پیشنهادیِ ردیف‌هایی که جداگانه Confirm نشده‌اند اعمال
                    نمی‌شود.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-3 py-2">id</th>
                    <th className="px-3 py-2">Current</th>
                    <th className="px-3 py-2">New (editable)</th>
                    <th className="px-3 py-2">action</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((correction) => {
                    const old = (d ? JSON.parse(d) : []) as Array<
                      Record<string, unknown>
                    >;
                    const current = old.find(
                      (item) => item.id === correction.id,
                    );
                    return (
                      <tr
                        key={correction.id}
                        className={`border-b align-top ${confirmedIds.has(correction.id) ? "bg-emerald-500/10" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono">{correction.id}</td>
                        <td className="px-3 py-2">
                          <pre className="whitespace-pre-wrap font-mono">
                            {JSON.stringify(current ?? "Not loaded", null, 2)}
                          </pre>
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            value={
                              drafts[correction.id] ??
                              JSON.stringify(correction, null, 2)
                            }
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [correction.id]: event.target.value,
                              }))
                            }
                            disabled={b}
                            className="min-h-32 w-full rounded border p-2 font-mono disabled:opacity-50"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            disabled={b}
                            onClick={() => void confirmOne(correction.id)}
                            className="rounded border px-2 py-1 transition active:scale-90 hover:bg-black/5 disabled:opacity-50"
                          >
                            {confirmedIds.has(correction.id)
                              ? "Confirm update ✓"
                              : "Confirm"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowApplyAllHelp((current) => !current)}
                  aria-label="About apply all proposed changes"
                  title="About apply all proposed changes"
                  className="rounded border p-1.5 transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <ActionIcon name="help" />
                </button>
                {showApplyAllHelp ? (
                  <div
                    dir="rtl"
                    className="absolute bottom-full right-0 z-10 mb-2 w-80 rounded border bg-background p-3 text-right text-xs shadow-elevated"
                  >
                    <strong>APPLY ALL PROPOSED CHANGES</strong> همهٔ تغییرات
                    پیشنهادشده در ستون New را برای تمام رکوردها در دیتابیس اعمال
                    می‌کند و همه را مرورشده ثبت می‌کند. در مقابل،{" "}
                    <strong>MARK ALL AS REVIEWED AND CLOSE</strong> فقط{" "}
                    <code>meanings_confirmed=true</code> را ثبت می‌کند و تغییرات
                    ردیف‌هایی که جداگانه Confirm نشده‌اند را نادیده می‌گیرد.
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={
                  b || !corrections.some((item) => !confirmedIds.has(item.id))
                }
                onClick={() => setApplyAllConfirmOpen(true)}
                className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50"
              >
                APPLY ALL PROPOSED CHANGES
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {applyAllConfirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="w-full max-w-lg rounded-2xl border border-card bg-background p-5 text-right shadow-elevated"
          >
            <h2 className="text-base font-semibold">
              اعمال همهٔ تغییرات پیشنهادی؟
            </h2>
            <p className="mt-3 text-sm leading-6">
              این عملیات تمام تغییرات ستون New را برای همهٔ رکوردهای
              نمایش‌داده‌شده در دیتابیس ثبت می‌کند و همه را مرورشده علامت می‌زند
              (<code>meanings_confirmed=true</code>). برخلاف{" "}
              <strong>MARK ALL AS REVIEWED AND CLOSE</strong>، تغییرات تأییدنشده
              نیز اعمال می‌شوند.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={b}
                onClick={() => setApplyAllConfirmOpen(false)}
                className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={b}
                onClick={() => {
                  const ids = (
                    (d ? JSON.parse(d) : []) as Array<{ id: number }>
                  ).map((item) => item.id);
                  const targetIds = ids.length
                    ? ids
                    : corrections.map((item) => item.id);
                  setApplyAllConfirmOpen(false);
                  void commit(targetIds, corrections);
                }}
                className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                تأیید و اعمال همه
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
