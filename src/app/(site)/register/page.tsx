import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { providerCatalog } from "@/lib/providers/providerCatalog";
import { RegisterClient } from "./RegisterClient";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = (await searchParams) ?? {};
  const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/";

  if (session?.user?.id) redirect(safeCallbackUrl);

  return (
    <RegisterClient
      callbackUrl={safeCallbackUrl}
      providers={providerCatalog}
    />
  );
}
