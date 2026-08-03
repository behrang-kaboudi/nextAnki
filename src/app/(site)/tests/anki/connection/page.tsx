import type { Metadata } from "next";

import AnkiConnectPlaygroundClient from "./playground.client";

export const metadata: Metadata = {
  title: "AnkiConnect Playground",
};

export default function AnkiConnectPlaygroundPage() {
  return <AnkiConnectPlaygroundClient />;
}

