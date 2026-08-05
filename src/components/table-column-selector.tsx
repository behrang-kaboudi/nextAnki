"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TableColumn = {
  key: string;
  label: string;
  required?: boolean;
};

export function TableColumnSelector({
  columns,
  selectedColumns,
}: {
  columns: readonly TableColumn[];
  selectedColumns: readonly string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(() => [...selectedColumns]);

  function updateColumns(key: string, checked: boolean) {
    const next = checked ? [...new Set([...selected, key])] : selected.filter((column) => column !== key);
    setSelected(next);

    const query = new URLSearchParams(searchParams.toString());
    query.delete("columns");
    next.forEach((column) => query.append("columns", column));
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  function resetColumns() {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("columns");
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <legend className="mr-1 font-medium">Columns</legend>
      {columns.map((column) => (
        <label key={column.key} className="flex items-center gap-1 whitespace-nowrap">
          {column.required ? <input type="hidden" name="columns" value={column.key} /> : null}
          <input
            name={column.required ? undefined : "columns"}
            type="checkbox"
            value={column.key}
            checked={selected.includes(column.key)}
            disabled={column.required}
            onChange={(event) => updateColumns(column.key, event.target.checked)}
          />
          {column.label}
        </label>
      ))}
      <button type="button" onClick={resetColumns} className="rounded border px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5">
        Reset columns
      </button>
    </fieldset>
  );
}
