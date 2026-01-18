"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import type { AuthProviderId } from "@/lib/providers/types";
import { AuthButton } from "./AuthButton";
import { getProviderBranding } from "./providerBranding";

export function OAuthButton({
  providerId,
  callbackUrl,
  onError,
  text,
  enabled = true,
}: {
  providerId: Exclude<AuthProviderId, "credentials">;
  callbackUrl: string;
  onError?: (message: string) => void;
  text?: string;
  enabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const branding = getProviderBranding(providerId);

  return (
    <AuthButton
      loading={loading}
      className={branding.className}
      leftIcon={branding.icon}
      ariaLabel={`Continue with ${branding.label}`}
      disabled={!enabled}
      onClick={async () => {
        if (!enabled) {
          onError?.(`${branding.label} is not configured yet.`);
          return;
        }
        setLoading(true);
        try {
          const res = await signIn(providerId, { callbackUrl, redirect: true });
          if (res?.error) onError?.(res.error);
        } catch {
          onError?.("Authentication failed");
        } finally {
          setLoading(false);
        }
      }}
    >
      {text ?? `Continue with ${branding.label}`}
    </AuthButton>
  );
}
