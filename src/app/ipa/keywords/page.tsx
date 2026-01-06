import { IpaKeywordsClient } from "./IpaKeywordsClient";

export const metadata = {
  title: "IPA Keywords",
};

export const runtime = "nodejs";

export default function IpaKeywordsPage() {
  return <IpaKeywordsClient />;
}

