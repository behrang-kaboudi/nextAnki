"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: number;
  base_form: string;
  phonetic_us: string | null;
  phonetic_us_normalized: string | null;
  meaning_fa: string;
  meaning_fa_IPA: string;
  meaning_fa_IPA_normalized: string;
};

async function fetchWords(take: number) {
  const res = await fetch(`/api/ipa-test/words?special=1&take=${encodeURIComponent(String(take))}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = (await res.json()) as { rows: Row[] };
  return json.rows;
}

async function backfillAllNormalized() {
  let startId = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;

  for (;;) {
    const res = await fetch(
      `/api/ipa-test/backfill-normalized?batch=500&startId=${encodeURIComponent(String(startId))}`,
      { method: "POST" }
    );
    if (!res.ok) throw new Error(`Backfill failed: ${res.status}`);
    const json = (await res.json()) as {
      processed: number;
      updated: number;
      nextStartId: number;
      done: boolean;
    };
    totalProcessed += json.processed;
    totalUpdated += json.updated;
    startId = json.nextStartId;
    if (json.done) break;
  }

  return { totalProcessed, totalUpdated };
}

export default function IpaTestWordsTable({ initialTake }: { initialTake: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);

  const initial = useMemo(() => (Number.isFinite(initialTake) ? Math.max(1, Math.min(200, initialTake)) : 100), [
    initialTake,
  ]);

  const load = async (take: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWords(take);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setRows(null);
    } finally {
      setLoading(false);
    }
  };

  const runBackfill = async () => {
    setLoading(true);
    setError(null);
    setBackfillStatus("Backfilling…");
    try {
      const { totalProcessed, totalUpdated } = await backfillAllNormalized();
      setBackfillStatus(`Backfill done. Processed: ${totalProcessed}, updated: ${totalUpdated}`);
      await load(100);
    } catch (e) {
      setBackfillStatus(null);
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => void runBackfill()}
          disabled={loading}
          style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "#fff" }}
        >
          {loading ? "Working…" : "Backfill normalized fields"}
        </button>
        <button
          type="button"
          onClick={() => void load(50)}
          disabled={loading}
          style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "#fff" }}
        >
          {loading ? "Loading…" : "Random 50"}
        </button>
        <button
          type="button"
          onClick={() => void load(100)}
          disabled={loading}
          style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "#fff" }}
        >
          {loading ? "Loading…" : "Random 100"}
        </button>
        <span style={{ color: "#555" }}>Filter: includes space / hyphen / boundaries / punctuation.</span>
      </div>
      {backfillStatus ? <p style={{ marginTop: 0, color: "#555" }}>{backfillStatus}</p> : null}

      {error ? (
        <pre style={{ color: "#b00", whiteSpace: "pre-wrap" }}>{error}</pre>
      ) : rows ? (
        <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#fafafa" }}>
                {[
                  "base_form",
                  "phonetic_us",
                  "phonetic_us_normalized",
                  "meaning_fa",
                  "meaning_fa_IPA",
                  "meaning_fa_IPA_normalized",
                ].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0", verticalAlign: "top" }}>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>{r.base_form}</td>
                  <td style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {r.phonetic_us ?? ""}
                  </td>
                  <td style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {r.phonetic_us_normalized ?? ""}
                  </td>
                  <td style={{ padding: 10 }}>{r.meaning_fa}</td>
                  <td style={{ padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                    {r.meaning_fa_IPA}
                  </td>
                  <td style={{ padding: 10 }}>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                      {r.meaning_fa_IPA_normalized}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Loading…</p>
      )}
    </section>
  );
}
