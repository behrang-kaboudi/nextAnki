import type { Metadata } from "next";

import CardTransferManagementClient from "./CardTransferManagementClient";

export const metadata: Metadata = {
  title: "Equivalent Card Reset",
};

export default function EquivalentCardResetPage() {
  return <CardTransferManagementClient />;
}
