"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthButton } from "./AuthButton";
import { ErrorAlert } from "./ErrorAlert";
import { getProviderBranding } from "./providerBranding";
import { PasswordField } from "./PasswordField";

export function AuthForm({
  mode,
  callbackUrl,
  showName,
  showConfirmPassword,
}: {
  mode: "login" | "register";
  callbackUrl: string;
  showName?: boolean;
  showConfirmPassword?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    try {
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      if (mode === "login") {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl,
        });
        if (res?.error) {
          setError("Invalid email or password");
          return;
        }
        router.push(res?.url ?? callbackUrl);
        return;
      }

      const name = showName ? String(formData.get("name") ?? "").trim() : "";
      const confirm = showConfirmPassword ? String(formData.get("confirm") ?? "") : password;
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (confirm !== password) {
        setError("Passwords do not match.");
        return;
      }

      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!registerRes.ok) {
        const data = (await registerRes.json().catch(() => ({}))) as { message?: string };
        setError(data.message || "Registration failed");
        return;
      }

      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}&registered=1`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const emailBranding = getProviderBranding("credentials");

  return (
    <form
      action={onSubmit}
      className="grid gap-3 rounded-2xl border border-card bg-card p-6 shadow-elevated"
      aria-label={mode === "login" ? "Email login form" : "Email registration form"}
    >
      {showName ? (
        <label className="grid gap-1">
          <span className="text-xs text-muted">Name</span>
          <input
            name="name"
            type="text"
            placeholder="Name (optional)"
            autoComplete="name"
            className="w-full rounded-xl border border-card bg-background px-4 py-3 text-sm text-foreground"
          />
        </label>
      ) : null}

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

      <PasswordField
        name="password"
        label="Password"
        required
        minLength={8}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
      />

      {showConfirmPassword ? (
        <PasswordField
          name="confirm"
          label="Confirm password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      ) : null}

      <AuthButton
        type="submit"
        loading={loading}
        leftIcon={emailBranding.icon}
        className={emailBranding.className}
      >
        {mode === "login" ? "Sign in" : "Sign up"}
      </AuthButton>

      {error ? <ErrorAlert message={error} /> : null}
    </form>
  );
}
