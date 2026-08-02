import type { Metadata } from "next";

import CardTransferManagementClient from "./CardTransferManagementClient";

export const metadata: Metadata = {
  title: "EnToFa and FaToEn Card Management",
};

export default function CardTransferManagementPage() {
  return <CardTransferManagementClient />;
}
