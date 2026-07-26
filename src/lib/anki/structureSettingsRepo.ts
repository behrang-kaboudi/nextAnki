import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createDefaultAnkiStructureConfig,
  normalizeAnkiStructureConfig,
  type AnkiStructureConfig,
} from "./structureSettings";

const SETTINGS_ID = "default";

export async function getAnkiStructureSettings() {
  const row = await prisma.ankiStructureSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    config: row ? normalizeAnkiStructureConfig(row.config) : createDefaultAnkiStructureConfig(),
    version: row?.version ?? 1,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    isPersisted: Boolean(row),
  };
}

export async function saveAnkiStructureSettings(config: AnkiStructureConfig) {
  const normalized = normalizeAnkiStructureConfig(config);
  const row = await prisma.ankiStructureSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      config: normalized as unknown as Prisma.InputJsonValue,
      version: 1,
    },
    update: {
      config: normalized as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });
  return {
    config: normalizeAnkiStructureConfig(row.config),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    isPersisted: true,
  };
}

export async function resetAnkiStructureSettings() {
  await prisma.ankiStructureSettings.deleteMany({ where: { id: SETTINGS_ID } });
  return {
    config: createDefaultAnkiStructureConfig(),
    version: 1,
    updatedAt: null,
    isPersisted: false,
  };
}
