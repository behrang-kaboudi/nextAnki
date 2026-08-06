"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const prompt = `Review each Persian meaning using base_form, meanings, and sentence_en. Return ONLY incorrect records; return [] if all are correct.\nINPUT: [{"id":1,"base_form":"example","meaning_fa":"نمونه","other_meanings_fa":[],"sentence_en":"This is an example."}]\nOUTPUT: [{"id":1,"meaning_fa":"نمونه","other_meanings_fa":["مثال"]}]`;
export default function WordMeaningsReview() {
  const r = useRouter(),
    [o, setO] = useState(false),
    [l, setL] = useState("50"),
    [d, setD] = useState(""),
    [a, setA] = useState(""),
    [b, setB] = useState(false),
    [e, setE] = useState<string | null>(null),
    [remaining, setRemaining] = useState<number | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const load = async () => {
    setB(true);
    setE(null);
    setNotice(null);
    try {
      const x = await fetch(
          `/api/words/meanings-review?limit=${encodeURIComponent(l)}`,
        ),
        j = (await x.json()) as {
          ok?: boolean;
          items?: unknown;
          totalUnconfirmed?: number;
          error?: string;
        };
      if (!x.ok || !j.ok) throw Error(j.error || "Could not create data.");
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
      const c = JSON.parse(a),
        ids = (JSON.parse(d) as Array<{ id: number }>).map((x) => x.id);
      if (!Array.isArray(c) || !ids.length)
        throw Error(
          "Response must be an array and data must be created first.",
        );
      const x = await fetch("/api/words/meanings-review/update-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, corrections: c }),
        }),
        j = await x.json();
      if (!x.ok || !j.ok) throw Error(j.error || "Could not apply review.");
      setA("");
      setNotice(`Updated ${j.updated}/${j.total} ✓`);
      r.refresh();
      await load();
    } catch (x) {
      setE(x instanceof Error ? x.message : String(x));
    } finally {
      setB(false);
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
      <button
        type="button"
        onClick={() => {
          setO(true);
          void load();
        }}
        disabled={b}
        className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        REVIEW PERSIAN MEANINGS
      </button>
      {o ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !b && setO(false)
          }
        >
          <div className="flex h-[85vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex justify-between">
              <div>
                <b>Persian meanings review — Word</b>
                <div className="text-xs opacity-70">
                  Only corrections are returned; Apply confirms all loaded rows.
                </div>
              </div>
              <button
                type="button"
                disabled={b}
                onClick={() => setO(false)}
                className="rounded border px-2 py-1 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>
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
                      min="1"
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
                  <button
                    type="button"
                    onClick={copyAll}
                    disabled={b || !d}
                    className="ml-2 rounded border px-2 py-1 text-xs transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    Copy all
                  </button>
                  {remaining !== null ? (
                    <span className="ml-2 text-xs font-semibold text-amber-700">
                      Remaining: {remaining}
                    </span>
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
                  placeholder='[{"id":1,"meaning_fa":"...","other_meanings_fa":[]}]'
                />
                <button
                  type="button"
                  onClick={() => void apply()}
                  disabled={b || !a.trim()}
                  className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  {b ? "Updating…" : "APPLY REVIEW"}
                </button>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
