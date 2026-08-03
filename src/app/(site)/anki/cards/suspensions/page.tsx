import type { Metadata } from "next";

import AnkiSuspendManagementClient from "./AnkiSuspendManagement.client";

export const metadata: Metadata = {
  title: "Anki Suspension Manager",
};

export default function AnkiSuspensionManagerPage() {
  return <AnkiSuspendManagementClient />;
}
