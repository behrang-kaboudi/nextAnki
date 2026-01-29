import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default async function WordsPageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.q) params.set("q", String(sp.q));
  if (sp.page) params.set("page", String(sp.page));
  if (sp.pageSize) params.set("pageSize", String(sp.pageSize));

  const qs = params.toString();
  redirect(qs ? `/word-hints?${qs}` : "/word-hints");
}
