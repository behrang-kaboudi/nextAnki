"use client";

import { LoadingSpinner } from "./LoadingSpinner";

export function AuthButton({
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  leftIcon,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      className={[
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-elevated transition disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {loading ? <LoadingSpinner className="size-4" /> : leftIcon}
      <span>{children}</span>
    </button>
  );
}

