export type OAuthProviderId = "google" | "microsoft-entra-id" | "github" | "apple";
export type AuthProviderId = "credentials" | "email" | OAuthProviderId;

export type ProviderDefinition = {
  id: AuthProviderId;
  name: string;
  enabled: boolean;
  icon: "email" | "magic" | "google" | "microsoft" | "github" | "apple";
};
