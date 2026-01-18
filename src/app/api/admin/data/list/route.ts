import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildSelect, buildWhere, getDelegate, getPrimaryKey, getSearchableFields, type ListParams } from "../_shared";

type MySqlColumn = { Field: string; Type: string };

function clampInt(n: unknown, def: number, min: number, max: number) {
  const v = typeof n === "string" ? Number.parseInt(n, 10) : typeof n === "number" ? n : Number.NaN;
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function escapeLikeLiteral(s: string) {
  return s.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function wildcardToLikePattern(s: string) {
  // `*` = exactly one character (SQL LIKE `_`)
  return escapeLikeLiteral(s).replaceAll("*", "_");
}

function ensureModel(model: string) {
  const ok = Prisma.dmmf.datamodel.models.some((m) => m.name === model);
  if (!ok) throw new Error(`Unknown model: ${model}`);
}

function parseModelFieldRef(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) return null;
  const model = raw.slice(0, dot).trim();
  const field = raw.slice(dot + 1).trim();
  if (!model || !field) return null;
  return { model, field };
}

async function getDbColumns(model: string) {
  const cols = (await prisma.$queryRawUnsafe(`SHOW COLUMNS FROM \`${model}\``)) as MySqlColumn[];
  return cols.map((c) => c.Field);
}

function sqlForFilters(
  params: ListParams,
  searchableFields: string[],
  allowedColsByModel: Map<string, Set<string>>,
) {
  const allowedCols = allowedColsByModel.get(params.model) ?? new Set<string>();
  const searchClauses: string[] = [];
  const filterClauses: string[] = [];
  const values: unknown[] = [];

  const search = (params.searchText ?? "").trim();
  if (search && searchableFields.length) {
    const or: string[] = [];
    for (const f of searchableFields) {
      if (!allowedCols.has(f)) continue;
      or.push(`\`${f}\` LIKE ?`);
      values.push(`%${search}%`);
    }
    if (or.length) searchClauses.push(`(${or.join(" OR ")})`);
  }

  for (const filter of params.filters ?? []) {
    if (!filter.field || !filter.op) continue;
    if (!allowedCols.has(filter.field)) continue;
    const field = filter.field;
    const v = filter.value;

    switch (filter.op) {
      case "eq":
        if (typeof v === "string" && v.includes("*")) {
          filterClauses.push(`\`${field}\` LIKE ? ESCAPE '\\\\'`);
          values.push(wildcardToLikePattern(v));
        } else {
          filterClauses.push(`\`${field}\` <=> ?`);
          values.push(v ?? null);
        }
        break;
      case "neq":
        if (typeof v === "string" && v.includes("*")) {
          filterClauses.push(`NOT (\`${field}\` LIKE ? ESCAPE '\\\\')`);
          values.push(wildcardToLikePattern(v));
        } else {
          filterClauses.push(`NOT (\`${field}\` <=> ?)`);
          values.push(v ?? null);
        }
        break;
      case "contains":
        if (typeof v === "string" && v.includes("*")) {
          let pattern = wildcardToLikePattern(v);
          if (!pattern.startsWith("%")) pattern = `%${pattern}`;
          if (!pattern.endsWith("%")) pattern = `${pattern}%`;
          filterClauses.push(`\`${field}\` LIKE ? ESCAPE '\\\\'`);
          values.push(pattern);
        } else {
          filterClauses.push(`\`${field}\` LIKE ?`);
          values.push(`%${String(v ?? "")}%`);
        }
        break;
      case "notContains":
        if (typeof v === "string" && v.includes("*")) {
          let pattern = wildcardToLikePattern(v);
          if (!pattern.startsWith("%")) pattern = `%${pattern}`;
          if (!pattern.endsWith("%")) pattern = `${pattern}%`;
          filterClauses.push(`NOT (\`${field}\` LIKE ? ESCAPE '\\\\')`);
          values.push(pattern);
        } else {
          filterClauses.push(`NOT (\`${field}\` LIKE ?)`);
          values.push(`%${String(v ?? "")}%`);
        }
        break;
      case "startsWith":
        if (typeof v === "string" && v.includes("*")) {
          let pattern = wildcardToLikePattern(v);
          pattern = pattern.replace(/^%+/, "");
          if (!pattern.endsWith("%")) pattern = `${pattern}%`;
          filterClauses.push(`\`${field}\` LIKE ? ESCAPE '\\\\'`);
          values.push(pattern);
        } else {
          filterClauses.push(`\`${field}\` LIKE ?`);
          values.push(`${String(v ?? "")}%`);
        }
        break;
      case "existsIn":
      case "notExistsIn": {
        const ref = parseModelFieldRef(v);
        if (!ref) throw new Error(`Invalid ${filter.op} value (use Model.field)`);
        ensureModel(ref.model);
        const otherAllowed = allowedColsByModel.get(ref.model);
        if (!otherAllowed?.has(ref.field)) throw new Error(`Unknown column: ${ref.model}.${ref.field}`);

        const existsSql = `EXISTS (SELECT 1 FROM \`${ref.model}\` WHERE \`${ref.model}\`.\`${ref.field}\` <=> \`${params.model}\`.\`${field}\`)`;
        filterClauses.push(filter.op === "notExistsIn" ? `NOT (${existsSql})` : existsSql);
        break;
      }
      case "gt":
        filterClauses.push(`\`${field}\` > ?`);
        values.push(v);
        break;
      case "gte":
        filterClauses.push(`\`${field}\` >= ?`);
        values.push(v);
        break;
      case "lt":
        filterClauses.push(`\`${field}\` < ?`);
        values.push(v);
        break;
      case "lte":
        filterClauses.push(`\`${field}\` <= ?`);
        values.push(v);
        break;
      case "lenEq":
        filterClauses.push(`CHAR_LENGTH(\`${field}\`) = ?`);
        values.push(clampInt(v, 0, 0, 1_000_000));
        break;
      case "lenGt":
        filterClauses.push(`CHAR_LENGTH(\`${field}\`) > ?`);
        values.push(clampInt(v, 0, 0, 1_000_000));
        break;
      case "lenGte":
        filterClauses.push(`CHAR_LENGTH(\`${field}\`) >= ?`);
        values.push(clampInt(v, 0, 0, 1_000_000));
        break;
      case "lenLt":
        filterClauses.push(`CHAR_LENGTH(\`${field}\`) < ?`);
        values.push(clampInt(v, 0, 0, 1_000_000));
        break;
      case "lenLte":
        filterClauses.push(`CHAR_LENGTH(\`${field}\`) <= ?`);
        values.push(clampInt(v, 0, 0, 1_000_000));
        break;
      case "in": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        if (arr.length) {
          filterClauses.push(`\`${field}\` IN (${arr.map(() => "?").join(",")})`);
          values.push(...arr);
        }
        break;
      }
      case "notIn": {
        const arr = Array.isArray(v) ? v : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
        if (arr.length) {
          filterClauses.push(`\`${field}\` NOT IN (${arr.map(() => "?").join(",")})`);
          values.push(...arr);
        }
        break;
      }
      case "isEmpty":
        filterClauses.push(`(\`${field}\` IS NULL OR \`${field}\` = '')`);
        break;
      case "isNotEmpty":
        filterClauses.push(`(\`${field}\` IS NOT NULL AND \`${field}\` <> '')`);
        break;
      default:
        break;
    }
  }

  const mode = params.filterMode === "any" ? "any" : "all";
  const andParts: string[] = [];
  if (searchClauses.length) andParts.push(searchClauses.join(" AND "));
  if (filterClauses.length) {
    andParts.push(mode === "any" ? `(${filterClauses.join(" OR ")})` : filterClauses.join(" AND "));
  }
  const whereSql = andParts.length ? `WHERE ${andParts.join(" AND ")}` : "";
  return { whereSql, values };
}

function stripLeadingWhere(sql: string) {
  return sql.trim().replace(/^where\\s+/i, "").trim();
}

function assertSafeSqlWhere(where: string) {
  const w = where.trim();
  if (!w) return;
  if (w.includes(";")) throw new Error("SQL WHERE must not include semicolons.");
  if (/--|\/\*/.test(w)) throw new Error("SQL comments are not allowed.");
  if (/\\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\\b/i.test(w)) {
    throw new Error("Only WHERE-style expressions are allowed.");
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as ListParams;
  const model = body?.model;
  if (!model) return NextResponse.json({ error: "model is required" }, { status: 400 });
  ensureModel(model);

  const delegate = getDelegate(model) as unknown as {
    findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
  const primaryKey = getPrimaryKey(model);
  const searchableFields = getSearchableFields(model);

  const pageSize = Math.min(200, Math.max(1, Number(body.pageSize ?? 20)));
  const page = Math.max(1, Number(body.page ?? 1));
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const wantsLength = (body.filters ?? []).some((f) => typeof f?.op === "string" && f.op.startsWith("len"));
  const wantsWildcard = (body.filters ?? []).some(
    (f) =>
      typeof f?.value === "string" &&
      f.value.includes("*") &&
      (f.op === "eq" || f.op === "neq" || f.op === "contains" || f.op === "notContains" || f.op === "startsWith"),
  );
  const wantsCrossTable = (body.filters ?? []).some((f) => f?.op === "existsIn" || f?.op === "notExistsIn");
  const requestedCols = Array.from(new Set([primaryKey, ...(body.visibleColumns ?? [])])).filter(Boolean);
  const wantsRawWhere = typeof body.sqlWhere === "string" && body.sqlWhere.trim().length > 0;

  // If the client wants length filtering OR requests columns not present in Prisma client,
  // fallback to raw SQL so the admin UI stays usable after schema changes.
  const dmmfModel = Prisma.dmmf.datamodel.models.find((m) => m.name === model) ?? null;
  const dmmfFields = new Set((dmmfModel?.fields ?? []).map((f) => f.name));
  const hasUnknownCols = requestedCols.some((c) => !dmmfFields.has(c));

  if (wantsLength || hasUnknownCols || wantsWildcard || wantsCrossTable || wantsRawWhere) {
    try {
      const dbCols = await getDbColumns(model);
      const allowedCols = new Set(dbCols);
      const allowedColsByModel = new Map<string, Set<string>>([[model, allowedCols]]);

      if (wantsCrossTable) {
        const otherModels = new Set<string>();
        for (const f of body.filters ?? []) {
          if (f?.op !== "existsIn" && f?.op !== "notExistsIn") continue;
          const ref = parseModelFieldRef(f.value);
          if (!ref) return NextResponse.json({ error: `Invalid ${String(f.op)} value (use Model.field)` }, { status: 400 });
          ensureModel(ref.model);
          otherModels.add(ref.model);
        }
        for (const m of otherModels) {
          const cols = await getDbColumns(m);
          allowedColsByModel.set(m, new Set(cols));
        }
      }

      const selectCols = requestedCols.filter((c) => allowedCols.has(c));
      const sortField = body.sort?.field && allowedCols.has(body.sort.field) ? body.sort.field : null;
      const sortDir = body.sort?.dir === "desc" ? "DESC" : "ASC";

      let { whereSql, values } = sqlForFilters(body, searchableFields, allowedColsByModel);
      const sqlParams = Array.isArray(body.sqlParams) ? body.sqlParams : [];
      if (wantsRawWhere) {
        const raw = stripLeadingWhere(body.sqlWhere ?? "");
        assertSafeSqlWhere(raw);
        whereSql = whereSql ? `${whereSql} AND (${raw})` : `WHERE (${raw})`;
      }
      const orderBySql = sortField ? `ORDER BY \`${sortField}\` ${sortDir}` : "";

      const rows = (await prisma.$queryRawUnsafe(
        `
          SELECT ${selectCols.map((c) => `\`${c}\``).join(", ")}
          FROM \`${model}\`
          ${whereSql}
          ${orderBySql}
          LIMIT ? OFFSET ?
        `,
        ...values,
        ...sqlParams,
        take,
        skip,
      )) as unknown[];

      const totalRes = (await prisma.$queryRawUnsafe(
        `
          SELECT COUNT(*) as cnt
          FROM \`${model}\`
          ${whereSql}
        `,
        ...values,
        ...sqlParams,
      )) as Array<{ cnt: number }>;

      const total = Number(totalRes?.[0]?.cnt ?? 0);
      return NextResponse.json({ rows, total });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  const where = buildWhere(
    {
      model,
      searchText: body.searchText,
      filters: body.filters ?? [],
      filterMode: body.filterMode,
      sort: body.sort,
      page,
      pageSize,
      visibleColumns: body.visibleColumns ?? [],
    },
    searchableFields,
  );

  const select = buildSelect(body.visibleColumns ?? [], primaryKey);
  const orderBy = body.sort?.field ? { [body.sort.field]: body.sort.dir } : undefined;

  try {
    const [rows, total] = await Promise.all([
      delegate.findMany({ where, orderBy, skip, take, select }),
      delegate.count({ where }),
    ]);
    return NextResponse.json({ rows, total });
  } catch {
    // Fallback to raw SQL if Prisma validation fails (e.g. stale client after schema changes during dev).
    const dbCols = await getDbColumns(model);
    const allowedCols = new Set(dbCols);
    const allowedColsByModel = new Map<string, Set<string>>([[model, allowedCols]]);
    const selectCols = requestedCols.filter((c) => allowedCols.has(c));
    const sortField = body.sort?.field && allowedCols.has(body.sort.field) ? body.sort.field : null;
    const sortDir = body.sort?.dir === "desc" ? "DESC" : "ASC";

    let { whereSql, values } = sqlForFilters(body, searchableFields, allowedColsByModel);
    const sqlParams = Array.isArray(body.sqlParams) ? body.sqlParams : [];
    if (wantsRawWhere) {
      const raw = stripLeadingWhere(body.sqlWhere ?? "");
      assertSafeSqlWhere(raw);
      whereSql = whereSql ? `${whereSql} AND (${raw})` : `WHERE (${raw})`;
    }
    const orderBySql = sortField ? `ORDER BY \`${sortField}\` ${sortDir}` : "";

    const rows = (await prisma.$queryRawUnsafe(
      `
        SELECT ${selectCols.map((c) => `\`${c}\``).join(", ")}
        FROM \`${model}\`
        ${whereSql}
        ${orderBySql}
        LIMIT ? OFFSET ?
      `,
      ...values,
      ...sqlParams,
      take,
      skip,
    )) as unknown[];

    const totalRes = (await prisma.$queryRawUnsafe(
      `
        SELECT COUNT(*) as cnt
        FROM \`${model}\`
        ${whereSql}
      `,
      ...values,
      ...sqlParams,
    )) as Array<{ cnt: number }>;

    const total = Number(totalRes?.[0]?.cnt ?? 0);
    return NextResponse.json({ rows, total });
  }
}
