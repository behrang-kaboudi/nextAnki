import SentenceDeckSyncClient from "./SentenceDeckSyncClient";

export const metadata = {
  title: "Sentence Card Sync",
};

export const runtime = "nodejs";

export default function SentenceDeckSyncPage() {
  return <SentenceDeckSyncClient />;
}
