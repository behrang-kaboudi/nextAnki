import { PageHeader } from "@/components/page-header";

import { ImageabilityClient } from "./ui/ImageabilityClient";

export default function WordImageabilityPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Word Sentences"
        subtitle="Paste a JSON array of Word ids with sentence fields to update."
      />
      <ImageabilityClient />
    </div>
  );
}
