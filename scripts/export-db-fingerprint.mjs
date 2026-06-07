import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

function loadEnv() {
  const cwd = process.cwd();
  const envLocal = path.join(cwd, ".env.local");
  const env = path.join(cwd, ".env");
  if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
  if (fs.existsSync(env)) dotenv.config({ path: env });
}

function getDelegateName(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function getStableKeyFields(model) {
  const idFields = model.fields.filter((field) => field.isId).map((field) => field.name);
  if (idFields.length > 0) return idFields;

  if (model.primaryKey?.fields?.length) return model.primaryKey.fields;

  if (model.uniqueFields?.length) {
    const compositeUnique = model.uniqueFields.find((fields) => fields.length > 1);
    if (compositeUnique) return compositeUnique;
    if (model.uniqueFields[0]?.length) return model.uniqueFields[0];
  }

  const uniqueField = model.fields.find((field) => field.isUnique && field.kind === "scalar");
  if (uniqueField) return [uniqueField.name];

  return [];
}

function normalizeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalizeValue(value[key]);
    }
    return normalized;
  }

  return value;
}

function stableStringify(value, space = 0) {
  return JSON.stringify(normalizeValue(value), null, space);
}

function compareStable(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function getSortToken(record, keyFields) {
  if (keyFields.length === 0) return stableStringify(record);

  const key = {};
  for (const field of keyFields) {
    key[field] = record[field];
  }
  return stableStringify(key);
}

async function readModelRows(prisma, model) {
  const delegateName = getDelegateName(model.name);
  const delegate = prisma[delegateName];
  if (!delegate?.findMany) {
    throw new Error(`Could not find Prisma delegate for model ${model.name}.`);
  }

  const keyFields = getStableKeyFields(model);
  const rows = await delegate.findMany();
  const normalizedRows = rows.map((row) => normalizeValue(row));

  normalizedRows.sort((left, right) => {
    const byKey = compareStable(getSortToken(left, keyFields), getSortToken(right, keyFields));
    if (byKey !== 0) return byKey;
    return compareStable(stableStringify(left), stableStringify(right));
  });

  return normalizedRows;
}

async function main() {
  loadEnv();

  const prisma = new PrismaClient();
  try {
    const models = [];

    for (const model of Prisma.dmmf.datamodel.models) {
      models.push({
        model: model.name,
        records: await readModelRows(prisma, model),
      });
    }

    const fingerprint = { models };
    const jsonText = `${stableStringify(fingerprint, 2)}\n`;
    const hash = crypto.createHash("sha256").update(jsonText, "utf8").digest("hex");

    const outDir = path.join(process.cwd(), "dbCompare");
    const jsonPath = path.join(outDir, "database_fingerprint.json");
    const hashPath = path.join(outDir, "database_fingerprint.sha256");

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(jsonPath, jsonText, "utf8");
    fs.writeFileSync(hashPath, `${hash}\n`, "utf8");

    process.stdout.write(`Wrote ${path.relative(process.cwd(), jsonPath)}\n`);
    process.stdout.write(`Wrote ${path.relative(process.cwd(), hashPath)}\n`);
    process.stdout.write(`${hash}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
