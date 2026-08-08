import { PageHeader } from "@/components/page-header";

import { LocalAiChatClient } from "./ui/LocalAiChatClient";

export default function LocalAiChatPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Local AI Studio"
        subtitle="Connect to LM Studio, save per-model generation settings, and test full conversations locally."
      />
      <LocalAiChatClient />
    </div>
  );
}
