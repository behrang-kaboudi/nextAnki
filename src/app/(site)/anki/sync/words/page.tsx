import SyncAnkiWordsClient from "./sync-anki-words.client";

export const metadata = {
  title: "Anki Word Sync",
};

export const runtime = "nodejs";

export default function SyncAnkiWordsPage() {
  return <SyncAnkiWordsClient />;
}
