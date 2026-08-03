import type { Metadata } from "next";

import AnkiCardTransferClient from "./AnkiCardTransferClient";

export const metadata: Metadata = {
  title: "Anki Card Transfer",
};

export default function AnkiCardTransferPage() {
  return <AnkiCardTransferClient />;
}
