import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { WordListClient } from "./WordList.client";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Phrase Building",
};

export default async function PhraseBuildingPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Phrase Building"
        subtitle="Build phrases from picture words."
      />

      <WordListClient />
    </div>
  );
}
