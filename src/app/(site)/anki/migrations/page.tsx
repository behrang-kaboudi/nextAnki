import type { Metadata } from "next";

import AnkiMigrationClient from "./AnkiMigrationClient";

export const metadata: Metadata = {
  title: "Anki Migrations",
};

export default function AnkiMigrationsPage() {
  return <AnkiMigrationClient />;
}
