import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getProviderEnvDiagnostics, providerCatalog } from "@/lib/providers/providerCatalog";
import { LoginClient } from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = (await searchParams) ?? {};
  const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/";

  if (session?.user?.id) redirect(safeCallbackUrl);

  return (
    <LoginClient
      callbackUrl={safeCallbackUrl}
      providers={providerCatalog}
      envDiagnostics={process.env.NODE_ENV !== "production" ? getProviderEnvDiagnostics() : []}
    />
  );
}
