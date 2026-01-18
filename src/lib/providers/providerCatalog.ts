import type { OAuthProviderId, ProviderDefinition } from "./types";

const isReal = (value: string | undefined) => Boolean(value && value.trim() && value !== "...");
const missing = (value: string | undefined) => !isReal(value);

export const providerCatalog: readonly ProviderDefinition[] = [
  { id: "credentials", name: "Email", enabled: true, icon: "email" },
  {
    id: "email",
    name: "Magic link",
    enabled:
      isReal(process.env.EMAIL_FROM) &&
      (isReal(process.env.SMTP_HOST) ||
        isReal(process.env.RESEND_API_KEY)),
    icon: "magic",
  },
  { id: "google", name: "Google", enabled: isReal(process.env.AUTH_GOOGLE_ID), icon: "google" },
  {
    id: "microsoft-entra-id",
    name: "Microsoft",
    enabled: isReal(process.env.AUTH_MICROSOFT_ENTRA_ID_ID) && isReal(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER),
    icon: "microsoft",
  },
  { id: "github", name: "GitHub", enabled: isReal(process.env.AUTH_GITHUB_ID), icon: "github" },
  { id: "apple", name: "Apple", enabled: isReal(process.env.AUTH_APPLE_ID), icon: "apple" },
] as const;

export const enabledOAuthProviders = providerCatalog.filter(
  (p): p is ProviderDefinition & { id: OAuthProviderId } =>
    p.enabled && p.id !== "credentials" && p.id !== "email",
);

export const emailMagicLinkEnabled = Boolean(
  providerCatalog.find((p) => p.id === "email")?.enabled,
);

export function getProviderEnvDiagnostics() {
  const diagnostics: { id: string; missing: string[] }[] = [];

  if (missing(process.env.AUTH_GOOGLE_ID) || missing(process.env.AUTH_GOOGLE_SECRET)) {
    diagnostics.push({
      id: "google",
      missing: [
        ...(missing(process.env.AUTH_GOOGLE_ID) ? ["AUTH_GOOGLE_ID"] : []),
        ...(missing(process.env.AUTH_GOOGLE_SECRET) ? ["AUTH_GOOGLE_SECRET"] : []),
      ],
    });
  }

  if (
    missing(process.env.AUTH_MICROSOFT_ENTRA_ID_ID) ||
    missing(process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET) ||
    missing(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER)
  ) {
    diagnostics.push({
      id: "microsoft-entra-id",
      missing: [
        ...(missing(process.env.AUTH_MICROSOFT_ENTRA_ID_ID)
          ? ["AUTH_MICROSOFT_ENTRA_ID_ID"]
          : []),
        ...(missing(process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET)
          ? ["AUTH_MICROSOFT_ENTRA_ID_SECRET"]
          : []),
        ...(missing(process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER)
          ? ["AUTH_MICROSOFT_ENTRA_ID_ISSUER"]
          : []),
      ],
    });
  }

  if (missing(process.env.AUTH_GITHUB_ID) || missing(process.env.AUTH_GITHUB_SECRET)) {
    diagnostics.push({
      id: "github",
      missing: [
        ...(missing(process.env.AUTH_GITHUB_ID) ? ["AUTH_GITHUB_ID"] : []),
        ...(missing(process.env.AUTH_GITHUB_SECRET) ? ["AUTH_GITHUB_SECRET"] : []),
      ],
    });
  }

  if (missing(process.env.EMAIL_FROM)) {
    diagnostics.push({ id: "email", missing: ["EMAIL_FROM", "SMTP_HOST/SMTP_URL or RESEND_API_KEY"] });
  }

  return diagnostics;
}
