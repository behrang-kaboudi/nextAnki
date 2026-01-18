import { PictureWordsClient } from "./PictureWordsClient";

export const metadata = {
  title: "Picture Words",
};

export const runtime = "nodejs";

export default function PictureWordsPage() {
  return <PictureWordsClient />;
}
