import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function DocsPage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Docs"
        subtitle="This is a skeleton to be expanded with full AnkiConnect docs and user flows."
      />

      <div className="grid gap-4">
        <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">Roadmap</div>
          <div className="mt-3 grid gap-2 text-sm leading-7 text-muted">
            <div>1) Connect page with real test (version + permissions)</div>
            <div>2) Read deck & model lists</div>
            <div>3) Create notes/cards with selectable templates</div>
            <div>4) Search & tag management</div>
          </div>
        </div>

        <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">Internal links</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/connect"
              className="rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground hover:bg-card"
            >
              Connect
            </Link>
            <Link
              href="/features"
              className="rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground hover:bg-card"
            >
              Features
            </Link>
            <Link
              href="/about"
              className="rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground hover:bg-card"
            >
              About
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
