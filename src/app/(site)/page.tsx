import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="-mx-4 -mt-8 grid gap-3 sm:-mx-8 lg:-mx-12">
      <section className="grid min-h-[58vh] place-items-center bg-card px-4 py-20 text-center sm:px-8">
        <div className="grid max-w-5xl gap-6">
          <PageHeader
            title="Anki Bridge"
            subtitle="A focused workspace for managing words, sentences, prompts, and Anki sync."
          />
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/word-extraction"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              Word Extraction
            </Link>
            <Link
              href="/tests"
              className="inline-flex items-center justify-center rounded-full text-sm font-semibold text-[var(--primary)] transition hover:text-foreground"
            >
              Browse tools
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 bg-background px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-3 sm:grid-cols-3">
          <div className="grid gap-2 bg-card p-6 text-center">
            <div className="text-lg font-semibold text-foreground">Words</div>
            <div className="text-sm leading-6 text-muted">Edit and enrich vocabulary data.</div>
          </div>
          <div className="grid gap-2 bg-card p-6 text-center">
            <div className="text-lg font-semibold text-foreground">Sentences</div>
            <div className="text-sm leading-6 text-muted">Manage examples and sentence cards.</div>
          </div>
          <div className="grid gap-2 bg-card p-6 text-center">
            <div className="text-lg font-semibold text-foreground">Anki</div>
            <div className="text-sm leading-6 text-muted">Keep note types and cards aligned.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:px-8 lg:px-0">
        <div className="text-center text-sm font-semibold text-foreground">Quick Actions</div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/word-extraction"
            className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
          >
            Word Extraction
          </Link>
          <Link
            href="/anki-note"
            className="inline-flex items-center justify-center rounded-full bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white/70"
          >
            Card Management
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-8 lg:px-0">
        <div className="bg-card p-6">
        {session ? (
          <div className="grid gap-4">
            <div className="text-sm font-semibold text-foreground">
              Signed in as
            </div>
            <pre className="overflow-auto rounded-xl border border-card bg-background p-4 text-xs text-foreground">
              {JSON.stringify(session.user, null, 2)}
            </pre>
            <Link
              href="/account"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              Account
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="text-sm text-muted">
              Sign in to access admin-only pages.
            </div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] transition hover:opacity-90"
            >
              Sign in
            </Link>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
