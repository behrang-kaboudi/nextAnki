import type { Metadata } from "next";

import AnkiKnowingFilterManagementClient from "./AnkiKnowingFilterManagement.client";

export const metadata: Metadata = {
  title: "Knowing Filter Card Management",
};

export default function AnkiKnowingFilterManagementPage() {
  return <AnkiKnowingFilterManagementClient />;
}
