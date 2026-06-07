import { prisma } from "@/lib/prisma";
import { buildDbFingerprintSnapshot } from "@/lib/dbCompare/dbFingerprint";
import { getGitComparison } from "@/lib/dbCompare/gitCompare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Database Compare | Admin",
};

function relationLabel(relation: "same" | "different" | "unknown", dirtyFiles: number) {
  if (dirtyFiles > 0 && relation === "same") return "Same commit as GitHub, with local file changes";
  if (dirtyFiles > 0 && relation === "different") return "Different from GitHub, with local file changes";
  if (relation === "same") return "Same as GitHub branch head";
  if (relation === "different") return "Different from GitHub branch head";
  return "Unknown";
}

function shortList(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" / ") || "—";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
}

export default async function AdminDbComparePage() {
  const [db, git] = await Promise.all([
    buildDbFingerprintSnapshot(prisma),
    getGitComparison(),
  ]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Database Compare
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Compare this checkout with the GitHub branch head and compare each
          database table by its deterministic SHA-256 hash.
        </p>
      </div>

      <section className="rounded-2xl border border-card bg-card p-4 shadow-elevated">
        <h2 className="text-sm font-semibold text-foreground">Git version</h2>
        {git.error ? (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
            {git.error}
          </div>
        ) : null}
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-card bg-background p-3">
            <div className="text-xs text-muted">Branch / upstream</div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {shortList([git.branch, git.upstream])}
            </div>
          </div>
          <div className="rounded-xl border border-card bg-background p-3">
            <div className="text-xs text-muted">Current HEAD</div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {git.localHead ?? "—"}
            </div>
          </div>
          <div className="rounded-xl border border-card bg-background p-3">
            <div className="text-xs text-muted">GitHub HEAD</div>
            <div className="mt-1 font-mono text-sm text-foreground">
              {git.githubHead ?? git.upstreamHead ?? "—"}
            </div>
          </div>
          <div className="rounded-xl border border-card bg-background p-3">
            <div className="text-xs text-muted">GitHub updated</div>
            <div className="mt-1 text-sm text-foreground">
              {formatDate(git.githubCommittedAt)}
            </div>
            <div className="mt-1 text-xs text-muted">
              Local: {formatDate(git.localCommittedAt)}
            </div>
          </div>
          <div className="rounded-xl border border-card bg-background p-3">
            <div className="text-xs text-muted">Status</div>
            <div className="mt-1 text-sm text-foreground">
              {relationLabel(git.relation, git.dirtyFiles)}
            </div>
            <div className="mt-1 text-xs text-muted">
              Ahead: {git.ahead ?? "—"} · Behind: {git.behind ?? "—"} · Dirty
              files: {git.dirtyFiles}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-card bg-card p-4 shadow-elevated">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Database fingerprint
            </h2>
            <p className="mt-1 text-xs text-muted">
              Hashes are built from Prisma Client reads, stable table order,
              stable record order, and sorted object keys.
            </p>
          </div>
          <div className="rounded-xl border border-card bg-background px-3 py-2">
            <div className="text-xs text-muted">Whole DB</div>
            <div className="mt-1 select-all font-mono text-xs text-foreground">
              {db.databaseSha256}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-card">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-background text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Model</th>
                <th className="px-3 py-2 font-semibold">Table</th>
                <th className="px-3 py-2 font-semibold">Rows</th>
                <th className="px-3 py-2 font-semibold">Order key</th>
                <th className="px-3 py-2 font-semibold">SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {db.tables.map((table) => (
                <tr key={table.model} className="border-t border-card">
                  <td className="px-3 py-2 font-medium text-foreground">
                    {table.model}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">
                    {table.table}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-foreground">
                    {table.count}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted">
                    {table.orderKey.join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    <span className="select-all font-mono text-xs text-foreground">
                      {table.sha256}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
