import { PageHeader } from "@/components/page-header";

import { DatabaseBackupClient } from "./DatabaseBackupClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Database Backup | Admin" };

export default function DatabaseBackupPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 py-4">
      <PageHeader
        title="Database Backup"
        subtitle="Create a complete database archive or replace this local database from the committed GitHub backup."
      />
      <DatabaseBackupClient />
    </div>
  );
}
