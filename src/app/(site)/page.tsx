import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { RoleGate } from "@/components/auth/RoleGate";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Dashboard"
        subtitle="Quick access to the Anki Bridge UI."
      />

      <div className="grid gap-3 rounded-2xl border border-card bg-card p-6 shadow-elevated">
        <div className="text-sm font-semibold text-foreground">Tools</div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/word-extraction"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
          >
            Word Extraction
          </Link>
          <RoleGate
            role="admin"
            fallback={null}
          >
            <Link
              href="/admin/themes"
              className="inline-flex items-center justify-center rounded-xl border border-card bg-background px-4 py-3 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95"
            >
              Admin
            </Link>
          </RoleGate>
        </div>
      </div>

      <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
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
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
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
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
