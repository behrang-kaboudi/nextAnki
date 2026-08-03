import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { PageHeader } from "@/components/page-header";

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/account");

  return (
    <div className="grid gap-8">
      <PageHeader title="Account" subtitle="Your current session." />

      <div className="grid gap-4 rounded-2xl border border-card bg-card p-6 shadow-elevated">
        <div className="text-sm font-semibold text-foreground">Signed in as</div>
        <pre className="overflow-auto rounded-xl border border-card bg-background p-4 text-xs text-foreground">
          {JSON.stringify(session.user, null, 2)}
        </pre>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
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
    </div>
  );
}

