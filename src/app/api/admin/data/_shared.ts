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
  | "lenEq"
  | "lenGt"
  | "lenGte"
  | "lenLt"
  | "lenLte"
  | "isEmpty"
  | "isNotEmpty"
  | "existsIn"
  | "notExistsIn"
  | "in"
  | "notIn";

export type Filter = { field: string; op: Operator; value?: unknown };
export type Sort = { field: string; dir: "asc" | "desc" };
export type FilterMode = "all" | "any";

export type ListParams = {
  model: string;
  searchText?: string;
  filters: Filter[];
  filterMode?: FilterMode;
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
  const searchAndMaybe: Array<Record<string, unknown>> = [];
  const filterClauses: Array<Record<string, unknown>> = [];

  const search = (params.searchText ?? "").trim();
  if (search && searchableFields.length) {
    searchAndMaybe.push({
      OR: searchableFields.map((f) => ({ [f]: { contains: search } })),
    });
  }

  for (const filter of params.filters ?? []) {
    if (!filter.field || !filter.op) continue;
    const field = filter.field;
    const v = filter.value;

    switch (filter.op) {
      case "eq":
        filterClauses.push({ [field]: { equals: v ?? null } });
        break;
      case "neq":
        filterClauses.push({ NOT: { [field]: { equals: v ?? null } } });
        break;
      case "contains":
        filterClauses.push({ [field]: { contains: String(v ?? "") } });
        break;
      case "notContains":
        filterClauses.push({ NOT: { [field]: { contains: String(v ?? "") } } });
        break;
      case "startsWith":
        filterClauses.push({ [field]: { startsWith: String(v ?? "") } });
        break;
      case "gt":
        filterClauses.push({ [field]: { gt: v } });
        break;
      case "gte":
        filterClauses.push({ [field]: { gte: v } });
        break;
      case "lt":
        filterClauses.push({ [field]: { lt: v } });
        break;
      case "lte":
        filterClauses.push({ [field]: { lte: v } });
        break;
      case "in": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        filterClauses.push({ [field]: { in: arr } });
        break;
      }
      case "notIn": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        filterClauses.push({ [field]: { notIn: arr } });
        break;
      }
      case "isEmpty":
        filterClauses.push({
          OR: [{ [field]: { equals: null } }, { [field]: { equals: "" } }],
        });
        break;
      case "isNotEmpty":
        filterClauses.push({
          AND: [{ NOT: { [field]: { equals: null } } }, { NOT: { [field]: { equals: "" } } }],
        });
        break;
      default:
        break;
    }
  }

  const mode: FilterMode = params.filterMode === "any" ? "any" : "all";
  if (mode === "any") {
    const AND: Array<Record<string, unknown>> = [...searchAndMaybe];
    if (filterClauses.length) AND.push({ OR: filterClauses });
    return AND.length ? { AND } : {};
  }

  const AND: Array<Record<string, unknown>> = [...searchAndMaybe, ...filterClauses];
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
