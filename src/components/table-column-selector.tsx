"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { TableColumnEmptyCounts } from "@/lib/words/tableColumnEmptyCounts.server";

type TableColumn = {
  key: string;
  label: string;
  required?: boolean;
};

const STORAGE_KEY_PREFIX = "anki.table-columns:";

function readStoredColumns(storageKey: string) {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeStoredColumns(storageKey: string, selected: readonly string[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(selected));
  } catch {
    // Column preferences are optional; keep the table usable if storage is unavailable.
  }
}

function clearStoredColumns(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Column preferences are optional; keep the table usable if storage is unavailable.
  }
}

export function TableColumnSelector({
  columns,
  selectedColumns,
  emptyCounts,
}: {
  columns: readonly TableColumn[];
  selectedColumns: readonly string[];
  emptyCounts?: TableColumnEmptyCounts;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `${STORAGE_KEY_PREFIX}${pathname}`;
  const availableKeys = useMemo(
    () => new Set(columns.map((column) => column.key)),
    [columns],
  );
  const requiredKeys = useMemo(
    () =>
      columns.filter((column) => column.required).map((column) => column.key),
    [columns],
  );
  const [selected, setSelected] = useState(() => [...selectedColumns]);
  const [isRefreshing, startRefresh] = useTransition();

  const normalizeSelection = useCallback(
    (value: readonly string[]) => [
      ...new Set([
        ...requiredKeys,
        ...value.filter((key) => availableKeys.has(key)),
      ]),
    ],
    [availableKeys, requiredKeys],
  );

  useEffect(() => {
    const requestedColumns = searchParams.getAll("columns");
    if (requestedColumns.length) {
      const next = normalizeSelection(requestedColumns);
      writeStoredColumns(storageKey, next);
      return;
    }

    const storedColumns = readStoredColumns(storageKey);
    if (!storedColumns) {
      return;
    }

    const next = normalizeSelection(storedColumns);
    const query = new URLSearchParams(searchParams.toString());
    next.forEach((column) => query.append("columns", column));
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }, [normalizeSelection, pathname, router, searchParams, storageKey]);

  function updateColumns(key: string, checked: boolean) {
    const next = normalizeSelection(
      checked
        ? [...selected, key]
        : selected.filter((column) => column !== key),
    );
    setSelected(next);
    writeStoredColumns(storageKey, next);

    const query = new URLSearchParams(searchParams.toString());
    query.delete("columns");
    next.forEach((column) => query.append("columns", column));
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  function resetColumns() {
    clearStoredColumns(storageKey);
    setSelected(normalizeSelection(selectedColumns));
    const query = new URLSearchParams(searchParams.toString());
    query.delete("columns");
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <legend className="mr-1 font-medium">Columns</legend>
      {columns.map((column) => (
        <label
          key={column.key}
          className="flex items-center gap-1 whitespace-nowrap"
        >
          {column.required ? (
            <input type="hidden" name="columns" value={column.key} />
          ) : null}
          <input
            name={column.required ? undefined : "columns"}
            type="checkbox"
            value={column.key}
            checked={selected.includes(column.key)}
            disabled={column.required}
            onChange={(event) =>
              updateColumns(column.key, event.target.checked)
            }
          />
          {column.label}
          {emptyCounts?.[column.key] !== undefined ? (
            <span
              className="text-xs font-medium text-red-600 dark:text-red-400"
              title={`${emptyCounts[column.key].toLocaleString()} empty values`}
            >
              ∅{emptyCounts[column.key].toLocaleString()}
            </span>
          ) : null}
        </label>
      ))}
      <button
        type="button"
        onClick={resetColumns}
        className="rounded border px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
      >
        Reset columns
      </button>
      {emptyCounts ? (
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={isRefreshing}
          aria-label="Refresh empty-field report"
          title="Refresh empty-field report"
          className="rounded border px-2 py-1 text-xs transition hover:bg-black/5 active:scale-95 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {isRefreshing ? "Refreshing…" : "Refresh report"}
        </button>
      ) : null}
    </fieldset>
  );
}
