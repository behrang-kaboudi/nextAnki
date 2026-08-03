import { ClearWordFieldsClient } from "./ClearWordFields.client";

export const metadata = {
  title: "Clear Word Fields",
};

export const runtime = "nodejs";

export default function ClearWordFieldsPage() {
  return <ClearWordFieldsClient />;
}
