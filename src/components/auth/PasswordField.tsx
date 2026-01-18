"use client";

import { useId, useState } from "react";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9" />
      <path d="M6.4 6.4C4.2 8 2.5 12 2.5 12s3.5 7 9.5 7c1.8 0 3.4-.4 4.8-1.1" />
      <path d="M14.1 5.2A9.6 9.6 0 0 1 12 5c-6 0-9.5 7-9.5 7a16 16 0 0 0 2.2 3.3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function PasswordField({
  name,
  label,
  placeholder = "••••••••",
  autoComplete,
  required,
  minLength,
}: {
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  const inputId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <label className="grid gap-1">
      <span className="text-xs text-muted">{label}</span>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full rounded-xl border border-card bg-background px-4 py-3 pr-12 text-sm text-foreground"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-lg px-2 text-muted transition hover:bg-card hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOffIcon className="size-5" />
          ) : (
            <EyeIcon className="size-5" />
          )}
        </button>
      </div>
    </label>
  );
}

