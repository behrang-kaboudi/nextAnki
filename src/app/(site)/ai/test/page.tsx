import { PageHeader } from "@/components/page-header";

import { AiTestClient } from "./ui/AiTestClient";

export default function AiTestPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="AI Test"
        subtitle="Sends a test chat request using OPENAI_API_KEY."
      />
      <AiTestClient />
    </div>
  );
}

