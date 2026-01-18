import { PageHeader } from "@/components/page-header";

import { PromptBuilderClient } from "./ui/PromptBuilderClient";

export default function PromptBuilderPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Prompt Builder"
        subtitle="Draft prompts here; we’ll expand this tool next."
      />
      <PromptBuilderClient />
    </div>
  );
}

