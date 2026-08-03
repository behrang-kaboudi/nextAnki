import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";

import ResetPasswordClientPage from "./ResetPasswordPage.client";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-8">
          <PageHeader title="Reset password" subtitle="Loading…" />
        </div>
      }
    >
      <ResetPasswordClientPage />
    </Suspense>
  );
}

