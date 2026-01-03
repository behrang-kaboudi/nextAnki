import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Operator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "startsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isEmpty"
  | "isNotEmpty"
  | "in"
  | "notIn";

export type Filter = { field: string; op: Operator; value?: unknown };
export type Sort = { field: string; dir: "asc" | "desc" };

export type ListParams = {
  model: string;
  searchText?: string;
  filters: Filter[];
  sort?: Sort;
  page: number;
  pageSize: number;
  visibleColumns: string[];
};

function lowerFirst(s: string) {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s;
}

export function getDelegate(model: string) {
  const key = lowerFirst(model);
  const delegate = (prisma as unknown as Record<string, unknown>)[key];
  if (!delegate) throw new Error(`Unknown model: ${model}`);
  return delegate as unknown;
}

export function getPrimaryKey(model: string) {
  const meta = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  if (!meta) return "id";
  const idField = meta.fields.find((f) => f.isId)?.name;
  if (idField) return idField;
  const composite = meta.primaryKey?.fields?.[0];
  if (composite) return composite;
  const unique = meta.fields.find((f) => f.isUnique)?.name;
  return unique ?? meta.fields[0]?.name ?? "id";
}

export function buildSelect(visibleColumns: string[], primaryKey: string) {
  const select: Record<string, true> = { [primaryKey]: true };
  for (const c of visibleColumns ?? []) select[c] = true;
  return select;
}

export function buildWhere(params: ListParams, searchableFields: string[]) {
  const AND: Array<Record<string, unknown>> = [];

  const search = (params.searchText ?? "").trim();
  if (search && searchableFields.length) {
    AND.push({
      OR: searchableFields.map((f) => ({ [f]: { contains: search } })),
    });
  }

  for (const filter of params.filters ?? []) {
    if (!filter.field || !filter.op) continue;
    const field = filter.field;
    const v = filter.value;

    switch (filter.op) {
      case "eq":
        AND.push({ [field]: { equals: v ?? null } });
        break;
      case "neq":
        AND.push({ NOT: { [field]: { equals: v ?? null } } });
        break;
      case "contains":
        AND.push({ [field]: { contains: String(v ?? "") } });
        break;
      case "notContains":
        AND.push({ NOT: { [field]: { contains: String(v ?? "") } } });
        break;
      case "startsWith":
        AND.push({ [field]: { startsWith: String(v ?? "") } });
        break;
      case "gt":
        AND.push({ [field]: { gt: v } });
        break;
      case "gte":
        AND.push({ [field]: { gte: v } });
        break;
      case "lt":
        AND.push({ [field]: { lt: v } });
        break;
      case "lte":
        AND.push({ [field]: { lte: v } });
        break;
      case "in": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        AND.push({ [field]: { in: arr } });
        break;
      }
      case "notIn": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        AND.push({ [field]: { notIn: arr } });
        break;
      }
      case "isEmpty":
        AND.push({
          OR: [{ [field]: { equals: null } }, { [field]: { equals: "" } }],
        });
        break;
      case "isNotEmpty":
        AND.push({
          AND: [{ NOT: { [field]: { equals: null } } }, { NOT: { [field]: { equals: "" } } }],
        });
        break;
      default:
        break;
    }
  }

  return AND.length ? { AND } : {};
}

export function getSearchableFields(model: string) {
  const meta = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  if (!meta) return [];
  return meta.fields
    .filter((f) => f.kind === "scalar" && f.type === "String" && !f.isList)
    .map((f) => f.name)
    .slice(0, 6);
}
