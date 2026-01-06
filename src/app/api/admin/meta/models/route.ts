import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type PrismaScalar =
  | "String"
  | "Int"
  | "Float"
  | "Boolean"
  | "DateTime"
  | "Json"
  | "BigInt"
  | "Decimal";

type PrismaField = {
  name: string;
  kind: "scalar" | "enum" | "object";
  type: PrismaScalar | string;
  isList: boolean;
  isRequired: boolean;
  isId?: boolean;
  isUnique?: boolean;
  hasDefaultValue?: boolean;
  documentation?: string | null;
};

type PrismaModelMeta = {
  name: string;
  dbName?: string | null;
  primaryKey: string;
  fields: PrismaField[];
  displayFields: string[];
  searchableFields: string[];
};

type PrismaRegistry = {
  models: PrismaModelMeta[];
  enums: Record<string, string[]>;
};

function asScalar(t: string): PrismaScalar | null {
  switch (t) {
    case "String":
    case "Int":
    case "Float":
    case "Boolean":
    case "DateTime":
    case "Json":
    case "BigInt":
    case "Decimal":
      return t;
    default:
      return null;
  }
}

function guessDisplayFields(fields: PrismaField[], primaryKey: string) {
  const candidates = fields.filter((f) => f.kind === "scalar" && f.type === "String" && !f.isList).map((f) => f.name);
  const picked = candidates.slice(0, 2);
  const result = Array.from(new Set([primaryKey, ...picked])).filter(Boolean);
  return result.length ? result : [primaryKey];
}

function guessSearchableFields(fields: PrismaField[]) {
  return fields
    .filter((f) => f.kind === "scalar" && f.type === "String" && !f.isList)
    .map((f) => f.name)
    .slice(0, 6);
}

function mysqlTypeToScalar(mysqlType: string): PrismaScalar {
  const t = mysqlType.toLowerCase();
  if (t.includes("int")) return "Int";
  if (t.includes("double") || t.includes("float")) return "Float";
  if (t.includes("decimal")) return "Decimal";
  if (t.includes("bool") || t.includes("tinyint(1)")) return "Boolean";
  if (t.includes("datetime") || t.includes("timestamp") || t.includes("date")) return "DateTime";
  if (t.includes("json")) return "Json";
  return "String";
}

type MySqlColumn = {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Key: "" | "PRI" | "UNI" | "MUL";
  Default: string | number | null;
  Extra: string;
};

export async function GET() {
  const dmmf = Prisma.dmmf;
  const enums: Record<string, string[]> = {};

  for (const e of dmmf.datamodel.enums ?? []) {
    enums[e.name] = e.values.map((v) => v.name);
  }

  const models: PrismaModelMeta[] = (dmmf.datamodel.models ?? []).map((m) => {
    const fields: PrismaField[] = m.fields.map((f) => {
      const scalar = typeof f.type === "string" ? asScalar(f.type) : null;
      const kind = (f.kind ?? "scalar") as PrismaField["kind"];
      return {
        name: f.name,
        kind,
        type: scalar ?? String(f.type),
        isList: !!f.isList,
        isRequired: !!f.isRequired,
        isId: !!f.isId,
        isUnique: !!f.isUnique,
        hasDefaultValue: !!f.hasDefaultValue,
        documentation: f.documentation ?? null,
      };
    });

    const primaryKey =
      fields.find((f) => f.isId)?.name ??
      m.primaryKey?.fields?.[0] ??
      fields.find((f) => f.isUnique)?.name ??
      fields[0]?.name ??
      "id";

    return {
      name: m.name,
      dbName: "dbName" in m ? (((m as unknown as { dbName?: string | null }).dbName ?? null) as string | null) : null,
      primaryKey,
      fields,
      displayFields: guessDisplayFields(fields, primaryKey),
      searchableFields: guessSearchableFields(fields),
    };
  });

  // Merge real DB columns to avoid stale Prisma.dmmf during dev (server not restarted / client not reloaded).
  // This keeps the admin UI in sync with the actual database schema.
  for (const m of models) {
    try {
      const cols = (await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM \`${m.name}\``)) as MySqlColumn[];
      const existing = new Set(m.fields.map((f) => f.name));
      for (const c of cols) {
        if (existing.has(c.Field)) continue;
        m.fields.push({
          name: c.Field,
          kind: "scalar",
          type: mysqlTypeToScalar(c.Type),
          isList: false,
          isRequired: c.Null === "NO",
          isId: c.Key === "PRI",
          isUnique: c.Key === "UNI",
          hasDefaultValue: c.Default !== null,
          documentation: null,
        });
      }
      m.displayFields = guessDisplayFields(m.fields, m.primaryKey);
      m.searchableFields = guessSearchableFields(m.fields);
    } catch {
      // ignore (table might not exist / permission)
    }
  }

  const registry: PrismaRegistry = { models, enums };
  return NextResponse.json(registry);
}
