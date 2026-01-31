import type { Metadata } from "next";

import AnkiNotePageClient from "./AnkiNotePage.client";

export const metadata: Metadata = {
  title: "Card Management",
};

export default function AnkiNotePage() {
  return <AnkiNotePageClient />;
}
