"use client";

import type { AuthProviderId } from "@/lib/providers/types";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.5-5.4 3.5A6.2 6.2 0 1 1 12 5.8c1.8 0 3 .8 3.7 1.5l2.5-2.5C16.7 3.2 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.9 0-.7-.1-1.2-.2-1.7H12Z"
      />
      <path fill="#34A853" d="M3.9 7.4l3.2 2.3A6.2 6.2 0 0 1 12 5.8c1.8 0 3 .8 3.7 1.5l2.5-2.5C16.7 3.2 14.6 2 12 2A10 10 0 0 0 3.9 7.4Z" opacity=".001" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.2-3.5-1.2-.5-1.2-1.1-1.6-1.1-1.6-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.3-.3-4.7-1.1-4.7-5A3.9 3.9 0 0 1 6.6 8.1c-.1-.3-.5-1.3.1-2.7 0 0 1-.3 2.8 1a9.5 9.5 0 0 1 5 0c1.8-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.7 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#F25022" d="M3 3h8v8H3z" />
      <path fill="#7FBA00" d="M13 3h8v8h-8z" />
      <path fill="#00A4EF" d="M3 13h8v8H3z" />
      <path fill="#FFB900" d="M13 13h8v8h-8z" />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.6 13.1c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.4 2.8 2.4 1.1 0 1.6-.7 3-0.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.7-2.2.8-1.2 1.1-2.3 1.2-2.4-.1 0-2.6-1-2.6-3.8ZM14.4 6.3c.6-.7 1-1.7.9-2.7-.9.1-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3Z"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path
        d="M4 6h16v12H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function getProviderBranding(providerId: AuthProviderId) {
  switch (providerId) {
    case "google":
      return {
        label: "Google",
        icon: <GoogleIcon className="size-5" />,
        className:
          "bg-[#DB4437] text-white hover:bg-[#c33a2f] border border-[#c33a2f]",
      };
    case "microsoft-entra-id":
      return {
        label: "Microsoft",
        icon: <MicrosoftIcon className="size-5" />,
        className:
          "bg-[#2F2F2F] text-white hover:bg-black border border-[#2F2F2F]",
      };
    case "github":
      return {
        label: "GitHub",
        icon: <GitHubIcon className="size-5" />,
        className:
          "bg-slate-900 text-white hover:bg-slate-800 border border-slate-700",
      };
    case "apple":
      return {
        label: "Apple",
        icon: <AppleIcon className="size-5" />,
        className:
          "bg-black text-white hover:bg-black/90 border border-slate-800",
      };
    case "credentials":
      return {
        label: "Email",
        icon: <MailIcon className="size-5" />,
        className:
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95",
      };
    case "email":
      return {
        label: "Magic link",
        icon: <MailIcon className="size-5" />,
        className:
          "bg-card text-foreground hover:bg-background border border-card",
      };
    default:
      return {
        label: providerId,
        icon: null,
        className:
          "bg-card text-foreground hover:bg-background border border-card",
      };
  }
}
