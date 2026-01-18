"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ErrorAlert } from "@/components/auth/ErrorAlert";
import { AuthForm } from "@/components/auth/AuthForm";
import { OAuthButton } from "@/components/auth/OAuthButton";
import type { ProviderDefinition } from "@/lib/providers/types";

export function RegisterClient({
  callbackUrl,
  providers,
}: {
  callbackUrl: string;
  providers: readonly ProviderDefinition[];
}) {
  const [error, setError] = useState<string | null>(null);
  const oauthProviders = providers.filter(
    (p) => p.id !== "credentials" && p.id !== "email",
  );

  return (
    <div className="mx-auto grid w-full max-w-md gap-6 py-10">
      <div className="rounded-3xl border border-card bg-card p-8 shadow-elevated">
        <div className="grid place-items-center gap-3">
          <div className="grid size-14 place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),#9333ea)] text-lg font-semibold text-white">
            A
          </div>
          <PageHeader
            title="New here? Create an account"
            subtitle="Sign up with an OAuth provider or email."
          />
        </div>

        <div className="mt-6 grid gap-3">
          {oauthProviders.map((p) => (
            <OAuthButton
              key={p.id}
              providerId={p.id}
              callbackUrl={callbackUrl}
              enabled={p.enabled}
              onError={(m) => setError(m)}
              text={`Sign up with ${p.name}`}
            />
          ))}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-xs text-muted">or</div>
          <div className="h-px flex-1 bg-border" />
        </div>

        <AuthForm
          mode="register"
          callbackUrl={callbackUrl}
          showName
          showConfirmPassword
        />

        <div className="mt-4 rounded-2xl border border-card bg-background p-4 text-sm text-muted">
          By signing up, we’ll email you a verification link. Verify your email before
          signing in.
        </div>

        {error ? <div className="mt-4"><ErrorAlert message={error} /></div> : null}

        <div className="mt-6 text-center text-sm text-muted">
          <Link
            className="underline underline-offset-4"
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
