import { PageHeader } from "@/components/page-header";

export default function ConnectPage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Connect to AnkiConnect"
        subtitle="This page is UI-only for now. A real connection test will be added next."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">
            Connection settings
          </div>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-2">
              <label className="text-xs text-muted">Service URL</label>
              <div className="rounded-xl border border-card bg-background px-3 py-3 text-sm text-foreground">
                http://127.0.0.1:8765
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-xs text-muted">API key (optional)</label>
              <div className="rounded-xl border border-card bg-background px-3 py-3 text-sm text-muted">
                (coming soon)
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
              >
                Test connection (soon)
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-card bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-card"
              >
                Save (soon)
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
          <div className="text-sm font-semibold text-foreground">Prerequisites</div>
          <ul className="mt-4 grid gap-3 text-sm leading-7 text-muted">
            <li className="rounded-xl border border-card bg-background p-4">
              Desktop: install the AnkiConnect add-on for Anki.
            </li>
            <li className="rounded-xl border border-card bg-background p-4">
              Android: AnkiDroid must allow local/network access (depending on
              your setup).
            </li>
            <li className="rounded-xl border border-card bg-background p-4">
              Default port: <span className="text-foreground">8765</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
