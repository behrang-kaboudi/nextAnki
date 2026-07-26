import type { Metadata } from "next";

import AnkiMigrationClient from "./AnkiMigrationClient";

export const metadata: Metadata = {
  title: "Migration",
};

export default function AnkiMigrationPage() {
  return <AnkiMigrationClient />;
}
