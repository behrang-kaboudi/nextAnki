import { NextResponse } from "next/server";
import { buildSelect, buildWhere, getDelegate, getPrimaryKey, getSearchableFields, type ListParams } from "../_shared";

export async function POST(req: Request) {
  const body = (await req.json()) as ListParams;
  const model = body?.model;
  if (!model) return NextResponse.json({ error: "model is required" }, { status: 400 });

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

  const where = buildWhere(
    {
      model,
      searchText: body.searchText,
      filters: body.filters ?? [],
      sort: body.sort,
      page,
      pageSize,
      visibleColumns: body.visibleColumns ?? [],
    },
    searchableFields,
  );

  const select = buildSelect(body.visibleColumns ?? [], primaryKey);
  const orderBy = body.sort?.field ? { [body.sort.field]: body.sort.dir } : undefined;

  const [rows, total] = await Promise.all([
    delegate.findMany({ where, orderBy, skip, take, select }),
    delegate.count({ where }),
  ]);

  return NextResponse.json({ rows, total });
}
