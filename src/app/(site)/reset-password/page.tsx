"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ErrorAlert } from "@/components/auth/ErrorAlert";
import { AuthButton } from "@/components/auth/AuthButton";
import { getProviderBranding } from "@/components/auth/providerBranding";
import { PasswordField } from "@/components/auth/PasswordField";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailBranding = getProviderBranding("credentials");

  async function onSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    try {
      const payload = {
        token,
        password: String(formData.get("password") ?? ""),
      };
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || "Reset failed");
      router.push("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader title="Reset password" subtitle="Set a new password for your account." />

      <form
        action={onSubmit}
        className="grid gap-3 rounded-2xl border border-card bg-card p-6 shadow-elevated"
      >
        <PasswordField
          name="password"
          label="New password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="New password (min 8 characters)"
        />
        <AuthButton
          type="submit"
          loading={loading}
          disabled={!token}
          leftIcon={emailBranding.icon}
          className={emailBranding.className}
        >
          Update password
        </AuthButton>
        {!token ? <div className="text-sm text-red-500">Missing token.</div> : null}
        {error ? <ErrorAlert message={error} /> : null}
      </form>

      <div className="text-sm text-muted">
        <Link className="underline underline-offset-4" href="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
