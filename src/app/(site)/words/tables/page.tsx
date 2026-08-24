import Link from "next/link";

import { PageHeader } from "@/components/page-header";

const tables = [
  { index: "01", title: "WordSense Table", model: "WordSense", href: "/words/tables/words", description: "Contextual vocabulary senses, Persian meanings, examples, relations, review workflows, and story generation." },
  { index: "02", title: "Persian Word Table", model: "PersianWord", href: "/words/tables/persian-words", description: "Canonical Persian meanings, normalized forms, confirmation state, links, and owned audio." },
  { index: "03", title: "English Word Table", model: "EnglishWord", href: "/words/tables/english-words", description: "Canonical English forms, US pronunciation, JSON sound hints, WordSense links, and owned audio." },
  { index: "04", title: "Sentence Table", model: "Sentence", href: "/words/tables/sentences", description: "Unique English examples, Persian translations, WordSense use, and sentence-owned audio." },
  { index: "05", title: "WordSenseStory Table", model: "WordSenseStory", href: "/words/tables/stories", description: "Reviewed mnemonic stories, exact sound symbols, source sentence, version state, and story-owned audio." },
] as const;

export const metadata = {
  title: "Word Tables",
  description: "Open the five primary vocabulary data tables.",
};

export default function WordTablesPage() {
  return <main className="mx-auto grid w-full max-w-7xl gap-8 p-4">
    <PageHeader title="Word Tables" subtitle="Five connected views of the vocabulary database, from canonical words and meanings to sentences, senses, and reviewed mnemonic stories." />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Primary word tables">
      {tables.map((table) => <Link key={table.href} href={table.href} className="group grid min-h-60 content-between gap-8 rounded-2xl border border-card bg-card p-6 shadow-elevated transition hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--primary),transparent_45%)] hover:shadow-[0_22px_55px_rgba(0,0,0,0.14)]">
        <div className="grid gap-4">
          <div className="flex items-start justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--primary),transparent_88%)] font-mono text-sm font-bold text-[var(--primary)]">{table.index}</span><code className="rounded-full border px-2 py-1 text-[11px] text-muted">{table.model}</code></div>
          <div><h2 className="text-xl font-bold text-foreground">{table.title}</h2><p className="mt-3 text-sm leading-6 text-muted">{table.description}</p></div>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]">Open table <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span></span>
      </Link>)}
    </section>
    <aside className="rounded-2xl border border-card bg-background px-5 py-4 text-sm leading-6 text-muted">
      WordSenseStory is source-dependent: changing or clearing an EnglishWord json_hint deletes its stories. A replacement story is created only through a separate reviewed prompt run.
    </aside>
  </main>;
}
