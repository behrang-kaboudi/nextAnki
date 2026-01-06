import { prisma } from "@/lib/prisma";

import { maybeBackupDatabase } from "./dbBackup";

declare global {
  // eslint-disable-next-line no-var
  var __dbBackupSchedulerStarted: boolean | undefined;
}

async function tick() {
  try {
    await maybeBackupDatabase(prisma);
  } catch (error) {
    console.error("DB backup tick failed:", error);
  }
}

export function startDbBackupScheduler() {
  const phase = process.env.NEXT_PHASE;
  if (phase === "phase-production-build") return;
  if (globalThis.__dbBackupSchedulerStarted) return;
  globalThis.__dbBackupSchedulerStarted = true;

  void tick();
  setInterval(() => void tick(), 10 * 60 * 1000);
}

startDbBackupScheduler();
