import type { Metadata } from "next";

import CardTransferManagementClient from "./CardTransferManagementClient";

export const metadata: Metadata = {
  title: "Reset Manager",
};

export default function CardTransferManagementPage() {
  return <CardTransferManagementClient />;
}
