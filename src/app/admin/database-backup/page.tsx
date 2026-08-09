import { PageHeader } from "@/components/page-header";

import { DatabaseBackupClient } from "./DatabaseBackupClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Database Backup | Admin" };

export default function DatabaseBackupPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 py-4">
      <PageHeader
        title="Database Backup"
        subtitle="Preserve an unchanged local archive, explicitly push local backup changes, or restore from GitHub."
      />
      <DatabaseBackupClient />
    </div>
  );
}
