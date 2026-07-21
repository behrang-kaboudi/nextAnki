import type { AnkiConnectResponse } from "../client";

export type RawAnkiConnectRequest = {
  action: string;
  version?: number;
  params?: unknown;
};

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

function buildPayload(request: RawAnkiConnectRequest) {
  return {
    action: request.action,
    version: request.version ?? 6,
    params: request.params ?? {},
  };
}

/** Browser-safe raw request. It always goes through the local Next.js proxy. */
export async function requestAnkiConnectRaw(
  request: RawAnkiConnectRequest,
): Promise<AnkiConnectResponse<unknown>> {
  const response = await fetch("/api/anki-connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildPayload(request)),
  });

  return (await response.json()) as AnkiConnectResponse<unknown>;
}

/** Server-only transport used by the Next.js proxy route. */
export async function forwardAnkiConnectRequest(
  request: RawAnkiConnectRequest,
): Promise<AnkiConnectResponse<unknown>> {
  const response = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildPayload(request)),
    cache: "no-store",
  });

  return (await response.json()) as AnkiConnectResponse<unknown>;
}
