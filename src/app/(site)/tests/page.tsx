import { TestsClient } from "./TestsClient";

export const metadata = {
  title: "Tests",
};

export const runtime = "nodejs";

export default function TestsPage() {
  return <TestsClient />;
}
