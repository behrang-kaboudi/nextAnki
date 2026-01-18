"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ErrorAlert } from "@/components/auth/ErrorAlert";
import { AuthForm } from "@/components/auth/AuthForm";
import { OAuthButton } from "@/components/auth/OAuthButton";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";
import type { ProviderDefinition } from "@/lib/providers/types";

export function LoginClient({
  callbackUrl,
  providers,
  envDiagnostics,
}: {
  callbackUrl: string;
  providers: readonly ProviderDefinition[];
  envDiagnostics: readonly { id: string; missing: string[] }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "magic">("password");
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
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">Anki Bridge</div>
            <div className="text-sm text-muted">Sign in to continue</div>
          </div>
        </div>

        {envDiagnostics.length && !oauthProviders.length ? (
          <div className="mt-6 rounded-2xl border border-card bg-background p-4 text-sm text-muted">
            <div className="font-semibold text-foreground">OAuth buttons hidden</div>
            <div className="mt-2 grid gap-2">
              {envDiagnostics.map((d) => (
                <div key={d.id}>
                  <span className="font-medium text-foreground">{d.id}:</span>{" "}
                  <span className="text-muted">{d.missing.join(", ")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs">
              After editing `.env.local`, restart `npm run dev`.
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {oauthProviders.map((p) => (
            <OAuthButton
              key={p.id}
              providerId={p.id}
              callbackUrl={callbackUrl}
              enabled={p.enabled}
              onError={(m) => setError(m)}
              text={`Continue with ${p.name}`}
            />
          ))}
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <div className="text-xs text-muted">or</div>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex w-full gap-2 rounded-2xl border border-card bg-background p-2">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
              mode === "password"
                ? "bg-background text-foreground shadow-elevated"
                : "text-muted hover:bg-background/60",
            ].join(" ")}
            aria-pressed={mode === "password"}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setMode("magic")}
            className={[
              "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
              mode === "magic"
                ? "bg-background text-foreground shadow-elevated"
                : "text-muted hover:bg-background/60",
            ].join(" ")}
            aria-pressed={mode === "magic"}
          >
            Magic link
          </button>
        </div>

        {mode === "password" ? (
          <AuthForm mode="login" callbackUrl={callbackUrl} />
        ) : (
          <MagicLinkForm callbackUrl={callbackUrl} />
        )}

        {error ? <div className="mt-4"><ErrorAlert message={error} /></div> : null}

        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-muted">
          <Link
            className="underline underline-offset-4"
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          >
            Create account
          </Link>
          <Link className="underline underline-offset-4" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
