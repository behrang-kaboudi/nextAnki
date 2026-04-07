import SentenceDeckSyncClient from "./SentenceDeckSyncClient";

export const metadata = {
  title: "Sentence Cards Management",
};

export const runtime = "nodejs";

export default function SentenceDeckSyncPage() {
  return <SentenceDeckSyncClient />;
}
