"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { MenuIcon } from "@/components/icons";

export function NavAuthWidget({
  variant,
  onNavigate,
}: {
  variant: "primary" | "mobile";
  onNavigate?: () => void;
}) {
  const { data, status } = useSession();
  const email = data?.user?.email;

  if (status === "loading") {
    return (
      <div
        className={
          variant === "primary"
            ? "inline-flex items-center gap-2 rounded-xl border border-card bg-card px-3 py-2 text-sm text-muted"
            : "flex items-center gap-2 rounded-xl border border-card bg-background px-3 py-3 text-sm text-muted"
        }
        aria-label="Loading session"
      >
        <span className="inline-block size-2 rounded-full bg-muted" />
        <span>Loading…</span>
      </div>
    );
  }

  if (email) {
    return (
      <Link
        href="/account"
        onClick={onNavigate}
        className={
          variant === "primary"
            ? "inline-flex items-center gap-2 rounded-xl border border-card bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-background"
            : "flex items-center gap-2 rounded-xl border border-card bg-background px-3 py-3 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-card"
        }
        aria-label="Account"
        title={email}
      >
        <MenuIcon name="account" className="size-5 opacity-80" />
        <span className="max-w-[14rem] truncate">{email}</span>
      </Link>
    );
  }

  return (
    <div
      className={variant === "primary" ? "inline-flex items-center gap-2" : "grid gap-2"}
      aria-label="Authentication links"
    >
      <Link
        href="/login"
        onClick={onNavigate}
        className={
          variant === "primary"
            ? "inline-flex items-center justify-center rounded-xl border border-card bg-card px-3 py-2 text-foreground shadow-elevated transition hover:bg-background"
            : "inline-flex items-center justify-center gap-2 rounded-xl border border-card bg-background px-3 py-3 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-card"
        }
        aria-label="Login"
        title="Login"
      >
        <MenuIcon name="login" className="size-5 opacity-80" />
        {variant === "mobile" ? <span>Login</span> : null}
      </Link>
      <Link
        href="/register"
        onClick={onNavigate}
        className={
          variant === "primary"
            ? "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-3 py-2 text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
            : "inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-3 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95"
        }
        aria-label="Register"
        title="Register"
      >
        {variant === "mobile" ? "Register" : "Sign up"}
      </Link>
    </div>
  );
}

