import "server-only";

type ActiveWordSyncJob = {
  name: string;
  startedAt: string;
};

type WordSyncLockState = {
  active: ActiveWordSyncJob | null;
};

function getLockState(): WordSyncLockState {
  const globalState = globalThis as unknown as {
    __ankiWordSyncJobLock?: WordSyncLockState;
  };
  if (!globalState.__ankiWordSyncJobLock) {
    globalState.__ankiWordSyncJobLock = { active: null };
  }
  return globalState.__ankiWordSyncJobLock;
}

export function getActiveWordSyncJob(): ActiveWordSyncJob | null {
  return getLockState().active;
}

export function acquireWordSyncJobLock(name: string): () => void {
  const state = getLockState();
  if (state.active) {
    throw new Error(
      `Anki word sync job "${state.active.name}" is already running (started ${state.active.startedAt}).`,
    );
  }

  const token: ActiveWordSyncJob = {
    name,
    startedAt: new Date().toISOString(),
  };
  state.active = token;

  return () => {
    if (state.active === token) state.active = null;
  };
}
