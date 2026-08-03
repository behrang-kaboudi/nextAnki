import type { Metadata } from "next";

import AnkiNotePageClient from "./AnkiNotePage.client";

export const metadata: Metadata = {
  title: "Anki Card Manager",
};

export default function AnkiCardManagerPage() {
  return <AnkiNotePageClient />;
}
