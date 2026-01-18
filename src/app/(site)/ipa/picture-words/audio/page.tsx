import { PictureWordsAudioClient } from "./pictureWordsAudioClient";

export const metadata = {
  title: "Picture Words Audio",
};

export const runtime = "nodejs";

export default function PictureWordsAudioPage() {
  return <PictureWordsAudioClient />;
}

