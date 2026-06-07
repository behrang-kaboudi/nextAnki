"use client";

import { useMemo, useState } from "react";

import type { DbFingerprintSnapshot, DbTableFingerprint } from "@/lib/dbCompare/dbFingerprint";

type CompareRow = {
  model: string;
  table: string;
  status: "same" | "different" | "missing-local" | "missing-other";
  localCount: number | null;
  otherCount: number | null;
  localSha256: string | null;
  otherSha256: string | null;
};

function normalizeSnapshot(value: unknown): DbFingerprintSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DbFingerprintSnapshot>;
  if (typeof record.databaseSha256 !== "string" || !Array.isArray(record.tables)) return null;

  const tables: DbTableFingerprint[] = [];
  for (const item of record.tables) {
    if (!item || typeof item !== "object") return null;
    const table = item as Partial<DbTableFingerprint>;
    if (
      typeof table.model !== "string" ||
      typeof table.table !== "string" ||
      typeof table.count !== "number" ||
      !Array.isArray(table.orderKey) ||
      typeof table.sha256 !== "string"
    ) {
      return null;
    }
    tables.push({
      model: table.model,
      table: table.table,
      count: table.count,
      orderKey: table.orderKey.map(String),
      sha256: table.sha256,
    });
  }

  return { databaseSha256: record.databaseSha256, tables };
}

function compareSnapshots(local: DbFingerprintSnapshot, other: DbFingerprintSnapshot) {
  const localByModel = new Map(local.tables.map((table) => [table.model, table]));
  const otherByModel = new Map(other.tables.map((table) => [table.model, table]));
  const models = Array.from(new Set([...localByModel.keys(), ...otherByModel.keys()])).sort();

  return models.map((model): CompareRow => {
    const localTable = localByModel.get(model) ?? null;
    const otherTable = otherByModel.get(model) ?? null;

    if (!localTable) {
      return {
        model,
        table: otherTable?.table ?? model,
        status: "missing-local",
        localCount: null,
        otherCount: otherTable?.count ?? null,
        localSha256: null,
        otherSha256: otherTable?.sha256 ?? null,
      };
    }

    if (!otherTable) {
      return {
        model,
        table: localTable.table,
        status: "missing-other",
        localCount: localTable.count,
        otherCount: null,
        localSha256: localTable.sha256,
        otherSha256: null,
      };
    }

    return {
      model,
      table: localTable.table,
      status: localTable.sha256 === otherTable.sha256 ? "same" : "different",
      localCount: localTable.count,
      otherCount: otherTable.count,
      localSha256: localTable.sha256,
      otherSha256: otherTable.sha256,
    };
  });
}

function statusLabel(status: CompareRow["status"]) {
  switch (status) {
    case "same":
      return "Same";
    case "different":
      return "Different";
    case "missing-local":
      return "Missing locally";
    case "missing-other":
      return "Missing in pasted JSON";
  }
}

export function DatabaseFingerprintActions({ snapshot }: { snapshot: DbFingerprintSnapshot }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareRows, setCompareRows] = useState<CompareRow[] | null>(null);

  const snapshotJson = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
  const differentRows = compareRows?.filter((row) => row.status !== "same") ?? [];
  const isSame = compareRows !== null && differentRows.length === 0;

  async function copySnapshot() {
    setCopyState("idle");
    try {
      await navigator.clipboard.writeText(snapshotJson);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function runCompare() {
    setCompareError(null);
    setCompareRows(null);

    try {
      const parsed = normalizeSnapshot(JSON.parse(pastedJson));
      if (!parsed) {
        setCompareError("JSON format is not a valid database fingerprint snapshot.");
        return;
      }

      setCompareRows(compareSnapshots(snapshot, parsed));
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copySnapshot}
          className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          Copy fingerprint JSON
        </button>
        <button
          type="button"
          onClick={() => {
            setIsCompareOpen(true);
            setCompareError(null);
            setCompareRows(null);
          }}
          className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
        >
          Compare pasted JSON
        </button>
        {copyState === "copied" ? <span className="text-xs text-green-700">Copied</span> : null}
        {copyState === "failed" ? <span className="text-xs text-red-700">Copy failed</span> : null}
      </div>

      {isCompareOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="database-fingerprint-compare-title"
        >
          <div className="w-full max-w-4xl rounded-2xl border border-card bg-card shadow-elevated">
            <div className="flex items-start justify-between gap-3 border-b border-card p-4">
              <div>
                <h3 id="database-fingerprint-compare-title" className="text-base font-semibold text-foreground">
                  Compare Database Fingerprints
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Paste fingerprint JSON copied from another system.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCompareOpen(false)}
                className="rounded-lg border border-card bg-background px-2 py-1 text-sm text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 p-4">
              <textarea
                value={pastedJson}
                onChange={(event) => setPastedJson(event.target.value)}
                placeholder="Paste database fingerprint JSON here..."
                className="min-h-48 w-full rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={runCompare}
                  className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Compare
                </button>
                {compareRows ? (
                  <span className={`text-sm font-semibold ${isSame ? "text-green-700" : "text-red-700"}`}>
                    {isSame ? "Databases match." : `Databases differ in ${differentRows.length} table(s).`}
                  </span>
                ) : null}
              </div>

              {compareError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                  {compareError}
                </div>
              ) : null}

              {compareRows ? (
                <div className="max-h-[45vh] overflow-auto rounded-xl border border-card">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="bg-background text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Model</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Local rows</th>
                        <th className="px-3 py-2 font-semibold">Other rows</th>
                        <th className="px-3 py-2 font-semibold">Local SHA</th>
                        <th className="px-3 py-2 font-semibold">Other SHA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareRows.map((row) => (
                        <tr key={row.model} className="border-t border-card">
                          <td className="px-3 py-2 font-medium text-foreground">{row.model}</td>
                          <td className="px-3 py-2 text-foreground">{statusLabel(row.status)}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{row.localCount ?? "—"}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{row.otherCount ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-foreground">{row.localSha256 ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-foreground">{row.otherSha256 ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
