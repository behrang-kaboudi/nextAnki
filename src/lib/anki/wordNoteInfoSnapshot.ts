import "server-only";

export type WordNoteInfoSnapshotItem = {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
};

type Snapshot = {
  createdAt: number;
  query: string;
  totalNotes: number;
  notes: WordNoteInfoSnapshotItem[];
};

const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

function getSnapshots(): Map<string, Snapshot> {
  const globalState = globalThis as unknown as {
    __wordNoteInfoSnapshots?: Map<string, Snapshot>;
  };
  if (!globalState.__wordNoteInfoSnapshots) {
    globalState.__wordNoteInfoSnapshots = new Map();
  }
  return globalState.__wordNoteInfoSnapshots;
}

function removeExpiredSnapshots(now = Date.now()) {
  const snapshots = getSnapshots();
  for (const [id, snapshot] of snapshots) {
    if (now - snapshot.createdAt > SNAPSHOT_TTL_MS) snapshots.delete(id);
  }
}

export function saveWordNoteInfoSnapshot(input: Omit<Snapshot, "createdAt">) {
  removeExpiredSnapshots();
  const id = crypto.randomUUID();
  getSnapshots().set(id, { ...input, createdAt: Date.now() });
  return id;
}

export function consumeWordNoteInfoSnapshot(id: string): Snapshot | null {
  removeExpiredSnapshots();
  const snapshots = getSnapshots();
  const snapshot = snapshots.get(id) ?? null;
  snapshots.delete(id);
  return snapshot;
}
