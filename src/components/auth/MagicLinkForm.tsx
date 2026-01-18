"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { AuthButton } from "@/components/auth/AuthButton";
import { ErrorAlert } from "@/components/auth/ErrorAlert";
import { getProviderBranding } from "@/components/auth/providerBranding";

export function MagicLinkForm({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const branding = getProviderBranding("email");

  return (
    <form
      className="grid gap-3 rounded-2xl border border-card bg-card p-6 shadow-elevated"
      action={async (formData) => {
        setError(null);
        setDone(false);
        setLoading(true);
        try {
          const email = String(formData.get("email") ?? "").trim();
          const res = await signIn("email", {
            email,
            callbackUrl,
            redirect: false,
          });
          if (res?.error) {
            setError("Could not send magic link.");
            return;
          }
          setDone(true);
        } catch {
          setError("Could not send magic link.");
        } finally {
          setLoading(false);
        }
      }}
      aria-label="Magic link login form"
    >
      <label className="grid gap-1">
        <span className="text-xs text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-card bg-background px-4 py-3 text-sm text-foreground"
        />
      </label>

      <AuthButton
        type="submit"
        loading={loading}
        leftIcon={branding.icon}
        className={branding.className}
        ariaLabel="Send magic link"
      >
        Send magic link
      </AuthButton>

      {done ? (
        <div className="text-sm text-foreground">
          If that email exists, a sign-in link has been sent.
        </div>
      ) : null}
      {error ? <ErrorAlert message={error} /> : null}
    </form>
  );
}

