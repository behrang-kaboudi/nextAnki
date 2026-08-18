import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import Link from "next/link";

import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Tests — External Source Catalog" };
export const runtime = "nodejs";

type CatalogSource = [id: string, type: string, name: string, scope: string, root: string | null];
type CatalogCategory = [ref: string, sourceIds: string[], label: string, url: string];
type CatalogLocation = [ref: string, sourceIds: string[], categoryRefs: string[], label: string, url: string, occurrences: number];
type CatalogEntry = [term: string, meaningFa: string, sourceRefs: string[]];
type UnresolvedItem = [sourceId: string, itemId: string | number, reason: string];
type QualityStatus = "valid" | "needs_cleanup" | "invalid_or_ambiguous";
type EntryQuality = [status: QualityStatus, flags: string[]];

type SourceStats = {
  categories?: number;
  locations?: number;
  occurrences?: number;
  notes?: number;
  extracted_pairs?: number;
  unresolved_notes?: number;
};

type ExternalCatalog = {
  schema_version: number;
  catalog_id: string;
  purpose: string;
  generated_at: string;
  sources: CatalogSource[];
  categories: CatalogCategory[];
  locations: CatalogLocation[];
  entries: CatalogEntry[];
  entry_quality?: EntryQuality[];
  unresolved_items: UnresolvedItem[];
  quality?: {
    method_id: string;
    classified_at: string;
    scope: string;
    status_definitions: Record<QualityStatus, string>;
    counts: Record<QualityStatus, number>;
    unresolved_source_items: number;
    flag_counts: Record<string, number>;
  };
  stats: {
    accepted_occurrences: number;
    unique_pairs: number;
    collapsed_duplicate_occurrences: number;
    unresolved_items: number;
    rejected_source_occurrences?: number;
    by_source: Record<string, SourceStats>;
  };
};

type PageParams = {
  q?: string;
  source?: string;
  quality?: string;
  view?: string;
  sort?: string;
  page?: string;
  pageSize?: string;
};

const CATALOG_FILE = "prompt-responses/external-vocabulary/2026-08-11-legacy-pipeline/a1-source-catalog.json";
const PAGE_SIZES = [25, 50, 100, 200] as const;
const SOURCE_BADGES: Record<string, string> = {
  "ba-books": "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
  "ba-levels": "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  "ba-common": "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  "ba-subjects": "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  ttwordbank: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};
const QUALITY_META: Record<QualityStatus, { label: string; className: string }> = {
  valid: { label: "Structurally valid", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
  needs_cleanup: { label: "Needs cleanup", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
  invalid_or_ambiguous: { label: "Invalid / ambiguous", className: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" },
};

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function formatBytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function SourceBadge({ id, label }: { id: string; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SOURCE_BADGES[id] ?? "bg-black/5 dark:bg-white/5"}`}>
      {label}
    </span>
  );
}

function QualityBadge({ status }: { status: QualityStatus }) {
  const meta = QUALITY_META[status];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span>;
}

function flagLabel(flag: string) {
  return flag.replaceAll("_", " ");
}

function hrefFor(params: Required<Pick<PageParams, "q" | "source" | "quality" | "view" | "sort" | "pageSize">>, overrides: Partial<PageParams> = {}) {
  const next = { ...params, ...overrides };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.source) query.set("source", next.source);
  if (next.quality) query.set("quality", next.quality);
  if (next.view && next.view !== "entries") query.set("view", next.view);
  if (next.sort && next.sort !== "source") query.set("sort", next.sort);
  query.set("page", String(overrides.page ?? 1));
  query.set("pageSize", String(next.pageSize));
  return `/tests/words/external-sources?${query.toString()}`;
}

export default async function ExternalSourceCatalogPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  const params = await searchParams;
  const catalogPath = path.join(process.cwd(), CATALOG_FILE);
  const [rawCatalog, catalogStat] = await Promise.all([readFile(catalogPath, "utf8"), stat(catalogPath)]);
  const catalog = JSON.parse(rawCatalog) as ExternalCatalog;
  const q = String(params.q ?? "").trim();
  const normalizedQuery = q.toLocaleLowerCase("fa-IR");
  const sourceIds = new Set(catalog.sources.map(([id]) => id));
  const source = sourceIds.has(String(params.source)) ? String(params.source) : "";
  const qualityStatuses = Object.keys(QUALITY_META) as QualityStatus[];
  const quality = qualityStatuses.includes(String(params.quality) as QualityStatus) ? String(params.quality) as QualityStatus : "";
  const view = params.view === "unresolved" ? "unresolved" : "entries";
  const allowedSorts = view === "entries" ? ["source", "term", "meaning", "evidence"] : ["source", "item", "reason"];
  const sort = allowedSorts.includes(String(params.sort)) ? String(params.sort) : "source";
  const requestedPageSize = positiveInt(params.pageSize, 50);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number]) ? requestedPageSize : 50;
  const requestedPage = positiveInt(params.page, 1);
  const sourceById = new Map(catalog.sources.map((item) => [item[0], item]));
  const sourceLabel = (id: string) => {
    const item = sourceById.get(id);
    if (!item) return id;
    return id === "ttwordbank" ? item[2] : `${item[2]} · ${item[3]}`;
  };
  const locationByRef = new Map(catalog.locations.map((item) => [item[0], item]));
  const sourceIdsForRefs = (refs: string[]) => {
    const ids = new Set<string>();
    for (const ref of refs) {
      if (ref.startsWith("ttw-n")) ids.add("ttwordbank");
      else for (const id of locationByRef.get(ref)?.[1] ?? []) ids.add(id);
    }
    return [...ids];
  };
  const allEntryRows = catalog.entries.map((entry, originalIndex) => ({
    entry,
    originalIndex,
    sourceIds: sourceIdsForRefs(entry[2]),
    quality: catalog.entry_quality?.[originalIndex] ?? (["needs_cleanup", ["quality_not_classified"]] as EntryQuality),
  }));
  const uniqueBySource = new Map(catalog.sources.map(([id]) => [id, 0]));
  for (const row of allEntryRows) {
    for (const id of row.sourceIds) uniqueBySource.set(id, (uniqueBySource.get(id) ?? 0) + 1);
  }
  const filteredEntries = allEntryRows.filter(({ entry: [term, meaningFa, refs], sourceIds: rowSourceIds, quality: [rowQuality] }) => {
    if (source && !rowSourceIds.includes(source)) return false;
    if (quality && rowQuality !== quality) return false;
    if (!normalizedQuery) return true;
    return `${term} ${meaningFa} ${refs.join(" ")}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery);
  });
  filteredEntries.sort((a, b) => {
    if (sort === "term") return a.entry[0].localeCompare(b.entry[0], "en", { sensitivity: "base" });
    if (sort === "meaning") return a.entry[1].localeCompare(b.entry[1], "fa");
    if (sort === "evidence") return b.entry[2].length - a.entry[2].length || a.originalIndex - b.originalIndex;
    return a.originalIndex - b.originalIndex;
  });
  const filteredUnresolved = catalog.unresolved_items.filter(([itemSourceId, itemId, reason]) => {
    if (source && itemSourceId !== source) return false;
    if (!normalizedQuery) return true;
    return `${sourceLabel(itemSourceId)} ${itemId} ${reason}`.toLocaleLowerCase("fa-IR").includes(normalizedQuery);
  });
  filteredUnresolved.sort((a, b) => {
    if (sort === "item") return String(a[1]).localeCompare(String(b[1]), "en", { numeric: true });
    if (sort === "reason") return a[2].localeCompare(b[2], "en");
    return a[0].localeCompare(b[0], "en") || String(a[1]).localeCompare(String(b[1]), "en", { numeric: true });
  });
  const total = view === "entries" ? filteredEntries.length : filteredUnresolved.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;
  const visibleEntries = filteredEntries.slice(start, start + pageSize);
  const visibleUnresolved = filteredUnresolved.slice(start, start + pageSize);
  const stableParams = { q, source, quality, view, sort, pageSize: String(pageSize) };
  const clearHref = `/tests/words/external-sources?view=${view}&page=1&pageSize=${pageSize}`;

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <PageHeader
        title="External Source Catalog"
        subtitle="Inspect the read-only, deduplicated vocabulary catalog collected from B-amooz and TTWordBank before database comparison."
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Unique pairs", catalog.stats.unique_pairs],
          ["Accepted observations", catalog.stats.accepted_occurrences],
          ["Duplicates collapsed", catalog.stats.collapsed_duplicate_occurrences],
          ["Unresolved", catalog.stats.unresolved_items],
        ].map(([label, value]) => (
          <section key={String(label)} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(Number(value))}</div>
          </section>
        ))}
        <section className="rounded-xl border bg-card p-3 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide opacity-60">Catalog file</div>
          <div className="mt-1 text-2xl font-semibold">{formatBytes(catalogStat.size)}</div>
          <div className="mt-1 truncate font-mono text-[10px] opacity-60" title={CATALOG_FILE}>{CATALOG_FILE}</div>
        </section>
      </div>

      {catalog.quality ? (
        <section className="mt-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Automatic quality triage</h2>
              <p className="mt-1 max-w-4xl text-sm opacity-70">{catalog.quality.scope} “Structurally valid” means no rule-based issue was detected; it does not guarantee that the translation is independently verified.</p>
            </div>
            <span className="rounded border px-2 py-1 font-mono text-[10px] opacity-60">{catalog.quality.method_id}</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {qualityStatuses.map((status) => (
              <Link key={status} href={hrefFor(stableParams, { view: "entries", quality: status, page: "1" })} className={`rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-sm ${quality === status && view === "entries" ? "ring-2 ring-[var(--primary)]" : ""}`}>
                <div className="flex items-center justify-between gap-2"><QualityBadge status={status} /><strong className="text-xl tabular-nums">{formatNumber(catalog.quality!.counts[status])}</strong></div>
                <p className="mt-2 text-xs leading-5 opacity-65">{catalog.quality!.status_definitions[status]}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Link href={hrefFor(stableParams, { view: "entries", sort: "source", page: "1" })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${view === "entries" ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/5"}`}>
            Entries · {formatNumber(catalog.entries.length)}
          </Link>
          <Link href={hrefFor(stableParams, { view: "unresolved", sort: "source", page: "1" })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${view === "unresolved" ? "bg-foreground text-background" : "hover:bg-black/5 dark:hover:bg-white/5"}`}>
            Unresolved · {formatNumber(catalog.unresolved_items.length)}
          </Link>
          <span className="ml-auto text-xs opacity-60">Schema v{catalog.schema_version} · generated {catalog.generated_at}</span>
        </div>
        <form className="flex flex-wrap items-end gap-3 p-3">
          <label className="grid min-w-64 flex-1 gap-1 text-xs font-medium">
            Search
            <input name="q" defaultValue={q} placeholder="English term, Persian meaning, reference…" className="rounded-lg border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Source
            <select name="source" defaultValue={source} className="min-w-56 rounded-lg border bg-background px-3 py-2 text-sm">
              <option value="">All sources</option>
              {catalog.sources.map(([id]) => <option key={id} value={id}>{sourceLabel(id)} · {formatNumber(uniqueBySource.get(id) ?? 0)} pairs</option>)}
            </select>
          </label>
          {view === "entries" ? <label className="grid gap-1 text-xs font-medium">
            Quality
            <select name="quality" defaultValue={quality} className="min-w-44 rounded-lg border bg-background px-3 py-2 text-sm">
              <option value="">All categories</option>
              {qualityStatuses.map((status) => <option key={status} value={status}>{QUALITY_META[status].label} · {formatNumber(catalog.quality?.counts[status] ?? 0)}</option>)}
            </select>
          </label> : null}
          <label className="grid gap-1 text-xs font-medium">
            Sort
            <select name="sort" defaultValue={sort} className="rounded-lg border bg-background px-3 py-2 text-sm">
              {view === "entries" ? <><option value="source">Source order</option><option value="term">English A–Z</option><option value="meaning">Persian A–Z</option><option value="evidence">Most evidence</option></> : <><option value="source">Source</option><option value="item">Item ID</option><option value="reason">Reason</option></>}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Rows
            <select name="pageSize" defaultValue={String(pageSize)} className="rounded-lg border bg-background px-3 py-2 text-sm">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5">Apply</button>
          {q || source || quality || sort !== "source" ? <Link href={clearHref} className="rounded-lg border px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Clear</Link> : null}
        </form>
      </section>

      <section className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {catalog.sources.map(([id, type, name, scope, root]) => {
          const stats = catalog.stats.by_source[id] ?? {};
          return (
            <article key={id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><SourceBadge id={id} label={id === "ttwordbank" ? name : scope} /><span className="text-[10px] uppercase opacity-50">{type}</span></div>
              <div className="mt-2 text-xl font-semibold tabular-nums">{formatNumber(uniqueBySource.get(id) ?? 0)}</div>
              <div className="text-xs opacity-60">unique pairs</div>
              <div className="mt-2 text-xs opacity-70">{stats.occurrences ? `${formatNumber(stats.occurrences)} observations` : `${formatNumber(stats.notes ?? 0)} notes · ${formatNumber(stats.extracted_pairs ?? 0)} extracted`}</div>
              {root ? <a href={root} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-[var(--primary)] hover:underline" title={root}>Open source</a> : null}
            </article>
          );
        })}
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="opacity-75">Showing <strong>{total ? start + 1 : 0}–{Math.min(start + pageSize, total)}</strong> of <strong>{formatNumber(total)}</strong> · Page <strong>{page}/{totalPages}</strong></span>
        <div className="flex gap-2">
          <Link href={hrefFor(stableParams, { page: String(Math.max(1, page - 1)) })} aria-disabled={page <= 1} className="rounded-lg border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-40 dark:hover:bg-white/5">Previous</Link>
          <Link href={hrefFor(stableParams, { page: String(Math.min(totalPages, page + 1)) })} aria-disabled={page >= totalPages} className="rounded-lg border px-3 py-2 hover:bg-black/5 aria-disabled:pointer-events-none aria-disabled:opacity-40 dark:hover:bg-white/5">Next</Link>
        </div>
      </div>

      {view === "entries" ? (
        <div className="mt-3 overflow-auto rounded-xl border">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-black/[0.025] dark:bg-white/[0.04]"><tr className="border-b"><th className="px-3 py-2">#</th><th className="px-3 py-2">English term</th><th className="px-3 py-2 text-right">Persian meaning</th><th className="px-3 py-2">Quality</th><th className="px-3 py-2">Sources</th><th className="px-3 py-2">Evidence</th></tr></thead>
            <tbody>
              {visibleEntries.map(({ entry: [term, meaningFa, refs], originalIndex, sourceIds: rowSourceIds, quality: [rowQuality, flags] }, index) => (
                <tr key={`${term}\u0000${meaningFa}\u0000${originalIndex}`} className="border-b align-top last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs opacity-55">{start + index + 1}</td>
                  <td className="max-w-72 px-3 py-3"><div className="font-semibold text-foreground">{term}</div><div className="mt-1 font-mono text-[10px] opacity-45">catalog row {originalIndex + 1}</div></td>
                  <td className="max-w-md px-3 py-3 text-right leading-6" dir="rtl">{meaningFa}</td>
                  <td className="max-w-64 px-3 py-3">
                    <QualityBadge status={rowQuality} />
                    {flags.length ? <div className="mt-2 flex flex-wrap gap-1">{flags.map((flag) => <span key={flag} className="rounded bg-black/5 px-1.5 py-1 text-[10px] leading-none opacity-70 dark:bg-white/10">{flagLabel(flag)}</span>)}</div> : <div className="mt-1 text-[10px] opacity-45">No structural flags</div>}
                  </td>
                  <td className="max-w-72 px-3 py-3"><div className="flex flex-wrap gap-1">{rowSourceIds.map((id) => <SourceBadge key={id} id={id} label={id === "ttwordbank" ? "TTWordBank" : sourceById.get(id)?.[3] ?? id} />)}</div></td>
                  <td className="min-w-56 px-3 py-3">
                    <details>
                      <summary className="cursor-pointer text-xs font-semibold text-[var(--primary)]">{formatNumber(refs.length)} reference{refs.length === 1 ? "" : "s"}</summary>
                      <ul className="mt-2 grid max-w-xl gap-1.5 text-xs">
                        {refs.slice(0, 20).map((ref) => {
                          if (ref.startsWith("ttw-n")) return <li key={ref} className="rounded border px-2 py-1.5"><span className="font-semibold">TTWordBank</span> · note <span className="font-mono">{ref.slice(5)}</span></li>;
                          const location = locationByRef.get(ref);
                          return <li key={ref} className="rounded border px-2 py-1.5">{location ? <a href={location[4]} target="_blank" rel="noreferrer" className="font-medium hover:underline">{location[3]}</a> : ref}<div className="mt-0.5 font-mono text-[10px] opacity-55">{ref}</div></li>;
                        })}
                        {refs.length > 20 ? <li className="px-2 py-1 text-xs opacity-60">+{formatNumber(refs.length - 20)} more references</li> : null}
                      </ul>
                    </details>
                  </td>
                </tr>
              ))}
              {!visibleEntries.length ? <tr><td colSpan={6} className="px-3 py-12 text-center opacity-65">No catalog entries match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 overflow-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-black/[0.025] dark:bg-white/[0.04]"><tr className="border-b"><th className="px-3 py-2">#</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Reason</th></tr></thead>
            <tbody>
              {visibleUnresolved.map(([itemSourceId, itemId, reason], index) => {
                const locationRef = typeof itemId === "string" ? itemId.split(":")[0] : "";
                const location = locationByRef.get(locationRef);
                return <tr key={`${itemSourceId}-${itemId}`} className="border-b align-top last:border-0"><td className="px-3 py-3 font-mono text-xs opacity-55">{start + index + 1}</td><td className="px-3 py-3"><SourceBadge id={itemSourceId} label={sourceLabel(itemSourceId)} /></td><td className="px-3 py-3 font-mono text-xs">{location ? <a href={location[4]} target="_blank" rel="noreferrer" className="text-[var(--primary)] hover:underline">{String(itemId)}</a> : String(itemId)}</td><td className="px-3 py-3"><code className="rounded bg-black/5 px-1.5 py-1 text-xs dark:bg-white/10">{reason}</code></td></tr>;
              })}
              {!visibleUnresolved.length ? <tr><td colSpan={4} className="px-3 py-12 text-center opacity-65">No unresolved items match these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
