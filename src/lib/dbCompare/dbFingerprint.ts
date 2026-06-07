import crypto from "node:crypto";

import { Prisma } from "@prisma/client";

import { compareStable, normalizeStable, stableStringify } from "./stable";

type PrismaDelegate = {
  count: () => Promise<number>;
  findMany: (args?: { orderBy?: Record<string, "asc"> | Array<Record<string, "asc">> }) => Promise<unknown[]>;
};

export type DbTableFingerprint = {
  model: string;
  table: string;
  count: number;
  orderKey: string[];
  sha256: string;
};

export type DbFingerprintSnapshot = {
  databaseSha256: string;
  tables: DbTableFingerprint[];
};

function lowerFirst(value: string) {
  return value ? value[0]!.toLowerCase() + value.slice(1) : value;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function getOrderFields(model: Prisma.DMMF.Model) {
  const idField = model.fields.find((field) => field.isId)?.name;
  if (idField) return [idField];
  if (model.primaryKey?.fields?.length) return model.primaryKey.fields;

  const uniqueField = model.fields.find((field) => field.isUnique)?.name;
  if (uniqueField) return [uniqueField];
  if (model.uniqueFields?.[0]?.length) return model.uniqueFields[0];

  return [];
}

function toOrderBy(fields: readonly string[]) {
  if (fields.length === 0) return undefined;
  if (fields.length === 1) return { [fields[0]!]: "asc" as const };
  return fields.map((field) => ({ [field]: "asc" as const }));
}

function getDelegate(prisma: object, modelName: string) {
  const delegate = (prisma as Record<string, unknown>)[lowerFirst(modelName)];
  if (!delegate || typeof delegate !== "object") return null;
  const maybeDelegate = delegate as Partial<PrismaDelegate>;
  if (typeof maybeDelegate.count !== "function" || typeof maybeDelegate.findMany !== "function") return null;
  return maybeDelegate as PrismaDelegate;
}

export async function buildDbFingerprintSnapshot(prisma: object): Promise<DbFingerprintSnapshot> {
  const tableDetails: Array<DbTableFingerprint & { records: unknown[] }> = [];

  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = getDelegate(prisma, model.name);
    if (!delegate) continue;

    const orderKey = getOrderFields(model);
    const orderBy = toOrderBy(orderKey);
    const records = await delegate.findMany(orderBy ? { orderBy } : undefined);
    if (!orderBy) records.sort(compareStable);

    const normalizedRecords = normalizeStable(records);
    const tableJson = `${stableStringify(normalizedRecords)}\n`;

    tableDetails.push({
      model: model.name,
      table: model.dbName ?? model.name,
      count: await delegate.count(),
      orderKey: orderKey.length ? [...orderKey] : ["stableJson"],
      sha256: sha256(tableJson),
      records: normalizedRecords as unknown[],
    });
  }

  const databaseJson = `${stableStringify(
    tableDetails.map(({ model, table, records }) => ({ model, table, records }))
  )}\n`;

  return {
    databaseSha256: sha256(databaseJson),
    tables: tableDetails.map((table) => ({
      model: table.model,
      table: table.table,
      count: table.count,
      orderKey: table.orderKey,
      sha256: table.sha256,
    })),
  };
}
