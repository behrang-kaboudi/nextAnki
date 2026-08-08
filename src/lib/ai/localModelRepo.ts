import "server-only";

import type { AiModel, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { normalizeBaseUrl, normalizeModelSettings } from "./localModels";

export type AiModelInput = {
  name: unknown;
  modelIdentifier: unknown;
  baseUrl: unknown;
  systemPrompt?: unknown;
  settings: unknown;
  isEnabled?: unknown;
  isDefault?: unknown;
};

export function serializeAiModel(model: AiModel) {
  return {
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}

function normalizeInput(input: AiModelInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const modelIdentifier = typeof input.modelIdentifier === "string" ? input.modelIdentifier.trim() : "";
  const systemPrompt = typeof input.systemPrompt === "string" ? input.systemPrompt.trim() || null : null;
  if (!name || name.length > 191) throw new Error("Model name must contain 1 to 191 characters.");
  if (!modelIdentifier || modelIdentifier.length > 191) {
    throw new Error("LM Studio model identifier must contain 1 to 191 characters.");
  }
  return {
    name,
    modelIdentifier,
    baseUrl: normalizeBaseUrl(input.baseUrl),
    systemPrompt,
    settings: normalizeModelSettings(input.settings) as Prisma.InputJsonValue,
    isEnabled: typeof input.isEnabled === "boolean" ? input.isEnabled : true,
    isDefault: typeof input.isDefault === "boolean" ? input.isDefault : false,
  };
}

export async function listAiModels() {
  const models = await prisma.aiModel.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  return models.map(serializeAiModel);
}

export async function createAiModel(input: AiModelInput) {
  const data = normalizeInput(input);
  const count = await prisma.aiModel.count();
  const shouldBeDefault = data.isDefault || count === 0;
  const model = await prisma.$transaction(async (tx) => {
    if (shouldBeDefault) await tx.aiModel.updateMany({ data: { isDefault: false } });
    return tx.aiModel.create({ data: { ...data, isDefault: shouldBeDefault } });
  });
  return serializeAiModel(model);
}

export async function updateAiModel(id: number, input: AiModelInput) {
  const data = normalizeInput(input);
  const model = await prisma.$transaction(async (tx) => {
    if (data.isDefault) await tx.aiModel.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return tx.aiModel.update({ where: { id }, data });
  });
  return serializeAiModel(model);
}

export async function deleteAiModel(id: number) {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.aiModel.delete({ where: { id } });
    if (deleted.isDefault) {
      const replacement = await tx.aiModel.findFirst({ where: { isEnabled: true }, orderBy: { name: "asc" } });
      if (replacement) await tx.aiModel.update({ where: { id: replacement.id }, data: { isDefault: true } });
    }
    return deleted;
  });
}
