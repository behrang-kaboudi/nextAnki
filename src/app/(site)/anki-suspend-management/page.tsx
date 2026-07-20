import type { Metadata } from "next";

import AnkiSuspendManagementClient from "./AnkiSuspendManagement.client";

export const metadata: Metadata = {
  title: "AnkiSuspendManagement",
};

export default function AnkiSuspendManagementPage() {
  return <AnkiSuspendManagementClient />;
}
