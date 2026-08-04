"use client";

import { useSyncExternalStore } from "react";

type ConnectionState = "connecting" | "open" | "reconnecting" | "closed";

type ProgressStoreSnapshot = {
  statuses: Record<string, unknown>;
  connectionState: ConnectionState;
};

const serverSnapshot: ProgressStoreSnapshot = {
  statuses: {},
  connectionState: "closed",
};

let snapshot: ProgressStoreSnapshot = serverSnapshot;
let source: EventSource | null = null;
const listeners = new Set<() => void>();

function emit(next: ProgressStoreSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function ensureConnected() {
  if (source || typeof window === "undefined") return;

  emit({ ...snapshot, connectionState: "connecting" });
  const eventSource = new EventSource("/api/progress/stream");
  source = eventSource;

  eventSource.onopen = () => {
    emit({ ...snapshot, connectionState: "open" });
  };
  eventSource.addEventListener("snapshot", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent<string>).data) as {
        statuses?: Record<string, unknown>;
      };
      if (data.statuses) {
        emit({ statuses: data.statuses, connectionState: "open" });
      }
    } catch {
      // Ignore a malformed event; EventSource keeps the stream alive.
    }
  });
  eventSource.onerror = () => {
    emit({ ...snapshot, connectionState: "reconnecting" });
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureConnected();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
      snapshot = { ...snapshot, connectionState: "closed" };
    }
  };
}

function getSnapshot() {
  return snapshot;
}

export function useJobProgressStatuses() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
}

export function useJobProgress<T>(topic: string) {
  const store = useJobProgressStatuses();
  return {
    status: (store.statuses[topic] as T | undefined) ?? null,
    connectionState: store.connectionState,
  };
}

