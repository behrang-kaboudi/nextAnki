import "server-only";

type ActiveWordSyncJob = {
  name: string;
  startedAt: string;
};

type WordSyncLockState = {
  activeByScope: Partial<Record<WordSyncJobScope, ActiveWordSyncJob>>;
};

export type WordSyncJobScope = "notes" | "media";

function getLockState(): WordSyncLockState {
  const globalState = globalThis as unknown as {
    __ankiWordSyncJobLock?: WordSyncLockState;
  };
  if (!globalState.__ankiWordSyncJobLock) {
    globalState.__ankiWordSyncJobLock = { activeByScope: {} };
  }
  return globalState.__ankiWordSyncJobLock;
}

export function getActiveWordSyncJob(
  scope: WordSyncJobScope = "notes",
): ActiveWordSyncJob | null {
  return getLockState().activeByScope[scope] ?? null;
}

export function acquireWordSyncJobLock(
  name: string,
  scope: WordSyncJobScope = "notes",
): () => void {
  const state = getLockState();
  const active = state.activeByScope[scope];
  if (active) {
    throw new Error(
      `Anki word sync job "${active.name}" is already running (started ${active.startedAt}).`,
    );
  }

  const token: ActiveWordSyncJob = {
    name,
    startedAt: new Date().toISOString(),
  };
  state.activeByScope[scope] = token;

  return () => {
    if (state.activeByScope[scope] === token) delete state.activeByScope[scope];
  };
}
