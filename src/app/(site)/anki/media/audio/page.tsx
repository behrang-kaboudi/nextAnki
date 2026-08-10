import { SharedAudioManager } from "./SharedAudioManager.client";

export const metadata = { title: "Audio Studio" };
export const runtime = "nodejs";

export default function SharedAudioPage() {
  return <SharedAudioManager />;
}
