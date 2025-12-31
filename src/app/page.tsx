import { auth, signIn, signOut } from "@/auth";
import { PageHeader } from "@/components/page-header";

export default async function Home() {
  const session = await auth();

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Dashboard"
        subtitle="Quick access to the Anki Bridge UI."
      />

      <div className="rounded-2xl border border-card bg-card p-6 shadow-elevated">
        {session ? (
          <div className="grid gap-4">
            <div className="text-sm font-semibold text-foreground">
              Signed in as
            </div>
            <pre className="overflow-auto rounded-xl border border-card bg-background p-4 text-xs text-foreground">
              {JSON.stringify(session.user, null, 2)}
            </pre>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="text-sm text-muted">
              Sign in to access admin-only pages.
            </div>
            <form
              action={async () => {
                "use server";
                await signIn("github");
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
              >
                Sign in with GitHub
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
