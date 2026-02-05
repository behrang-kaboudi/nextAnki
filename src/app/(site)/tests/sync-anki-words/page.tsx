import SyncAnkiWordsClient from "./sync-anki-words.client";

export const metadata = {
  title: "Sync Anki/Words",
};

export const runtime = "nodejs";

export default function SyncAnkiWordsPage() {
  return <SyncAnkiWordsClient />;
}
