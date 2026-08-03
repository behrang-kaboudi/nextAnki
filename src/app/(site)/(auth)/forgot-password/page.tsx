"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ErrorAlert } from "@/components/auth/ErrorAlert";
import { AuthButton } from "@/components/auth/AuthButton";
import { getProviderBranding } from "@/components/auth/providerBranding";

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const emailBranding = getProviderBranding("credentials");

  async function onSubmit(formData: FormData) {
    setError(null);
    setStatus("loading");
    try {
      const payload = { email: String(formData.get("email") ?? "") };
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setStatus("idle");
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader title="Forgot password" subtitle="We’ll email you a reset link." />

      <form
        action={onSubmit}
        className="grid gap-3 rounded-2xl border border-card bg-card p-6 shadow-elevated"
      >
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded-xl border border-card bg-background px-4 py-3 text-sm text-foreground"
        />
        <AuthButton
          type="submit"
          loading={status === "loading"}
          leftIcon={emailBranding.icon}
          className={emailBranding.className}
        >
          Send reset link
        </AuthButton>
        {error ? <ErrorAlert message={error} /> : null}
        {status === "done" ? (
          <div className="text-sm text-foreground">
            If that email exists, a reset link has been sent.
          </div>
        ) : null}
      </form>

      <div className="text-sm text-muted">
        <Link className="underline underline-offset-4" href="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
