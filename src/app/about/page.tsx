import { PageHeader } from "@/components/page-header";

export default function AboutPage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="About"
        subtitle="Anki Bridge is a Next.js UI project for managing Anki; the real AnkiConnect integration comes next."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated lg:col-span-2">
          <div className="text-sm font-semibold text-foreground">Goal</div>
          <p className="mt-2 text-sm leading-7 text-muted">
            This phase focuses on design and static pages. Next, we’ll add
            AnkiConnect integration to enable operations like listing decks,
            creating cards, and searching.
          </p>
        </div>

        <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">Tech stack</div>
          <ul className="mt-2 grid gap-2 text-sm leading-7 text-muted">
            <li>Next.js (App Router)</li>
            <li>TypeScript</li>
            <li>Tailwind CSS</li>
            <li>Static-first UI</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
