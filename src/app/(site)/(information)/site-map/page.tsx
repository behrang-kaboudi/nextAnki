import Link from "next/link";

import { siteMapGroups } from "@/config/siteMap";

export const metadata = {
  title: "Site Map",
  description: "A human-readable map of every canonical Anki Bridge page.",
};

export default function SiteMapPage() {
  const pageCount = siteMapGroups.reduce((total, group) => total + group.pages.length, 0);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8">
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Navigation reference</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Site Map</h1>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          A human-readable inventory of {pageCount} canonical pages. Each summary explains the page&apos;s job,
          so this map can guide both people and AI-assisted development.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {siteMapGroups.map((group) => (
          <section key={group.id} className="grid content-start gap-4 rounded-2xl border border-card bg-card p-5 shadow-elevated">
            <header>
              <div className="text-xs font-medium uppercase tracking-wide text-muted">{group.category}</div>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{group.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{group.summary}</p>
            </header>

            <div className="grid gap-2">
              {group.pages.map((page) => {
                const isDynamic = page.path.includes(":");
                const content = (
                  <>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{page.title}</h3>
                      <code className="text-[11px] text-muted">{page.path}</code>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted">{page.summary}</p>
                  </>
                );

                return isDynamic ? (
                  <div key={page.path} className="rounded-xl border border-card bg-background p-3">{content}</div>
                ) : (
                  <Link key={page.path} href={page.path} className="rounded-xl border border-card bg-background p-3 transition hover:border-foreground/20 hover:bg-card">
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
