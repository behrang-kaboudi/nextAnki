import AnkiRevlogClient from "./revlog.client";

export const metadata = {
  title: "Anki Revlog (AnkiDroid)",
};

export const runtime = "nodejs";

export default function AnkiRevlogPage() {
  return <AnkiRevlogClient />;
}

