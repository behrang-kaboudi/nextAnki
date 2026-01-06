"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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

type Filter = { field: string; op: Operator; value?: unknown };
type Sort = { field: string; dir: "asc" | "desc" };
type FilterMode = "all" | "any";

type ListParams = {
  model: string;
  searchText?: string;
  filters: Filter[];
  filterMode?: FilterMode;
  sort?: Sort;
  page: number;
  pageSize: number;
  visibleColumns: string[];
};

type Row = Record<string, unknown>;
type ListResponse = { rows: Row[]; total: number };

type ApiOk = { ok: true };
type BulkDeleteResponse = ApiOk & { deletedCount: number };
type CreateUpdateResponse = { row: Row };

// Option A: embedded registry fallback.
// Replace this with a generated registry that mirrors your Prisma schema,
// or rely on Option B: GET /api/admin/meta/models.
const prismaRegistry: PrismaRegistry = {
  models: [],
  enums: {},
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeJsonPreview(v: unknown) {
  try {
    const json = JSON.stringify(v);
    if (json.length <= 80) return json;
    return json.slice(0, 77) + "...";
  } catch {
    return String(v);
  }
}

function formatCellValue(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.map((x) => (x === null || x === undefined ? "—" : String(x))).join(", ");
  if (typeof v === "object") return safeJsonPreview(v);
  return String(v);
}

function downloadBlob(filename: string, contentType: string, data: string) {
  const blob = new Blob([data], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Row[], columns: string[]) {
  const escape = (s: unknown) => {
    const str = s === null || s === undefined ? "" : String(s);
    if (/[,"\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const header = columns.map(escape).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(r?.[c])).join(","));
  return [header, ...lines].join("\n");
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function isScalarType(t: PrismaField["type"]): t is PrismaScalar {
  return (
    t === "String" ||
    t === "Int" ||
    t === "Float" ||
    t === "Boolean" ||
    t === "DateTime" ||
    t === "Json" ||
    t === "BigInt" ||
    t === "Decimal"
  );
}

function operatorOptionsForField(field: PrismaField, enums: PrismaRegistry["enums"]): Operator[] {
  if (field.kind === "object") return [];
  if (field.isList) {
    if (field.type === "String") return ["contains", "isEmpty", "isNotEmpty", "in", "notIn"];
    return ["isEmpty", "isNotEmpty"];
  }
  if (field.kind === "enum" || (!isScalarType(field.type) && enums[field.type])) return ["eq", "neq", "in", "notIn"];
  if (!isScalarType(field.type)) return ["eq", "neq"];
  switch (field.type) {
    case "String":
      return [
        "eq",
        "neq",
        "contains",
        "notContains",
        "startsWith",
        "existsIn",
        "notExistsIn",
        "lenEq",
        "lenGt",
        "lenGte",
        "lenLt",
        "lenLte",
        "isEmpty",
        "isNotEmpty",
        "in",
        "notIn",
      ];
    case "Int":
    case "Float":
    case "BigInt":
    case "Decimal":
      return ["eq", "neq", "gt", "gte", "lt", "lte", "existsIn", "notExistsIn", "isEmpty", "isNotEmpty", "in", "notIn"];
    case "DateTime":
      return ["eq", "gt", "gte", "lt", "lte", "existsIn", "notExistsIn", "isEmpty", "isNotEmpty", "in", "notIn"];
    case "Boolean":
      return ["eq", "neq"];
    case "Json":
      return ["isEmpty", "isNotEmpty"];
    default:
      return ["eq", "neq"];
  }
}

function isLengthOperator(op: Operator) {
  return op === "lenEq" || op === "lenGt" || op === "lenGte" || op === "lenLt" || op === "lenLte";
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

function shouldUseTextarea(field: PrismaField) {
  const n = field.name.toLowerCase();
  return n.includes("body") || n.includes("description") || n.includes("content") || n.includes("json");
}

function isAutoManagedUpdatedAt(field: PrismaField) {
  const name = field.name.toLowerCase();
  const doc = (field.documentation ?? "").toLowerCase();
  return (
    name === "updatedat" ||
    (name === "updatedat" &&
      field.hasDefaultValue &&
      (doc.includes("auto") || doc.includes("managed") || doc.includes("updated at") || doc.includes("@updatedat")))
  );
}

function isAutoManagedCreatedAt(field: PrismaField) {
  const name = field.name.toLowerCase();
  return name === "createdat" && field.hasDefaultValue;
}

function datetimeLocalFromIso(iso: unknown) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeInputValue(
  field: PrismaField,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (raw === "" || raw === undefined) raw = null;
  if (raw === null) return { ok: true, value: null };

  const kind = field.kind;
  const t = field.type;

  if (kind === "enum") return { ok: true, value: raw };

  if (field.isList) {
    if (t === "String") {
      const s = String(raw);
      const arr = s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      return { ok: true, value: arr };
    }
    return { ok: true, value: raw };
  }

  if (!isScalarType(t)) return { ok: true, value: raw };

  switch (t) {
    case "Int": {
      const n = typeof raw === "number" ? raw : Number(String(raw));
      if (!Number.isFinite(n) || !Number.isInteger(n)) return { ok: false, error: "عدد صحیح معتبر نیست." };
      return { ok: true, value: n };
    }
    case "Float": {
      const n = typeof raw === "number" ? raw : Number(String(raw));
      if (!Number.isFinite(n)) return { ok: false, error: "عدد معتبر نیست." };
      return { ok: true, value: n };
    }
    case "Boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      if (raw === "true") return { ok: true, value: true };
      if (raw === "false") return { ok: true, value: false };
      return { ok: false, error: "مقدار بولین معتبر نیست." };
    }
    case "DateTime": {
      const s = String(raw);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "تاریخ/زمان معتبر نیست." };
      return { ok: true, value: d.toISOString() };
    }
    case "Json": {
      if (typeof raw === "object") return { ok: true, value: raw };
      try {
        return { ok: true, value: JSON.parse(String(raw)) };
      } catch {
        return { ok: false, error: "JSON معتبر نیست." };
      }
    }
    case "Decimal":
    case "BigInt": {
      const s = String(raw);
      if (!s) return { ok: true, value: null };
      return { ok: true, value: s };
    }
    case "String":
    default:
      return { ok: true, value: String(raw) };
  }
}

async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

function getErrorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}

function Button({
  variant = "default",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50";
  const sizes =
    size === "sm"
      ? "h-8 px-3"
      : size === "lg"
        ? "h-10 px-4"
        : size === "icon"
          ? "h-9 w-9"
          : "h-9 px-4";
  const variants =
    variant === "secondary"
      ? "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
      : variant === "outline"
        ? "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50"
        : variant === "destructive"
          ? "bg-red-600 text-white hover:bg-red-700"
          : variant === "ghost"
            ? "bg-transparent text-neutral-900 hover:bg-neutral-100"
            : "bg-neutral-900 text-white hover:bg-neutral-800";
  return <button className={cn(base, sizes, variants, className)} {...props} />;
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[84px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-9 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      disabled={disabled}
      type="checkbox"
      className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-400"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  );
}

function Badge({ children, variant = "secondary" }: { children: React.ReactNode; variant?: "secondary" | "outline" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "outline" ? "border border-neutral-200 text-neutral-700" : "bg-neutral-100 text-neutral-700",
      )}
    >
      {children}
    </span>
  );
}

function Separator() {
  return <div className="h-px w-full bg-neutral-200" />;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">{children}</div>;
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-neutral-200 px-4 py-3">{children}</div>;
}

function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

function Icon({
  name,
  className,
}: {
  name:
    | "plus"
    | "refresh"
    | "download"
    | "trash"
    | "eye"
    | "edit"
    | "chevron"
    | "compress"
    | "expand"
    | "braces"
    | "minify"
    | "arrowUp"
    | "arrowDown";
  className?: string;
}) {
  const common = cn("h-4 w-4", className);
  switch (name) {
    case "plus":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "refresh":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      );
    case "download":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 16h10l1-16" />
        </svg>
      );
    case "eye":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "edit":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case "compress":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3H3v5" />
          <path d="M16 21h5v-5" />
          <path d="M3 8l6-6" />
          <path d="M21 16l-6 6" />
        </svg>
      );
    case "expand":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8V3h5" />
          <path d="M21 16v5h-5" />
          <path d="M8 3L3 8" />
          <path d="M16 21l5-5" />
        </svg>
      );
    case "braces":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 4c-2 0-3 1-3 3v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 1 3 3 3" />
          <path d="M14 4c2 0 3 1 3 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2-1 3-3 3" />
          <path d="M11.5 10h1" />
          <path d="M11.5 14h1" />
        </svg>
      );
    case "minify":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16" />
          <path d="M6 12h12" />
          <path d="M8 17h8" />
          <path d="M9 10l-3 2 3 2" />
          <path d="M15 10l3 2-3 2" />
        </svg>
      );
    case "arrowUp":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 19V5" />
          <path d="M6 11l6-6 6 6" />
        </svg>
      );
    case "arrowDown":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14" />
          <path d="M6 13l6 6 6-6" />
        </svg>
      );
  }
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onOutside();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onOutside]);
  return ref;
}

function DropdownMenu({
  trigger,
  children,
  align = "end",
}: {
  trigger: (args: { open: boolean; setOpen: (v: boolean) => void }) => React.ReactNode;
  children: (args: { close: () => void }) => React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  return (
    <div className="relative inline-block" ref={ref}>
      {trigger({ open, setOpen })}
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-30 mt-2 w-64 rounded-md border border-neutral-200 bg-white p-1 shadow-lg",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}

function reorderArray<T>(arr: T[], from: number, to: number) {
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

function ColumnOrderEditor({
  columns,
  onReorder,
  onRemove,
}: {
  columns: string[];
  onReorder: (next: string[]) => void;
  onRemove: (column: string) => void;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-1 gap-1">
      {columns.map((c, idx) => (
        <div
          key={c}
          draggable
          onDragStart={(e) => {
            setDragFrom(idx);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(idx));
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const raw = e.dataTransfer.getData("text/plain");
            const from = Number(raw);
            const to = idx;
            if (!Number.isFinite(from) || from < 0 || from >= columns.length) return;
            if (from === to) return;
            onReorder(reorderArray(columns, from, to));
            setDragFrom(null);
          }}
          onDragEnd={() => setDragFrom(null)}
          className={cn(
            "flex items-center gap-2 rounded border border-transparent px-2 py-1 text-sm text-neutral-800",
            "hover:bg-neutral-50",
            dragFrom === idx && "border-neutral-200 bg-neutral-50",
          )}
          title="Drag to reorder"
        >
          <span className="select-none text-neutral-400" aria-hidden>
            ⋮⋮
          </span>
          <span className="min-w-0 flex-1 truncate">{c}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(c);
            }}
            aria-label={`Remove column ${c}`}
            title="Remove from visible columns"
          >
            <Icon name="trash" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  widthClass = "max-w-2xl",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "w-[calc(100%-24px)] rounded-lg border border-neutral-200 p-0 shadow-xl backdrop:bg-black/40",
        widthClass,
      )}
      onClose={() => onOpenChange(false)}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div className="text-sm font-semibold text-neutral-900">{title}</div>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close">
          ×
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-auto px-4 py-3">{children}</div>
      {footer ? <div className="border-t border-neutral-200 px-4 py-3">{footer}</div> : null}
    </dialog>
  );
}

type Toast = { id: string; type: "success" | "error"; title: string; description?: string };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3500);
  };
  return { toasts, push };
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[340px] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border p-3 shadow-lg",
            t.type === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50",
          )}
        >
          <div className="text-sm font-semibold text-neutral-900">{t.title}</div>
          {t.description ? <div className="mt-1 text-xs text-neutral-700">{t.description}</div> : null}
        </div>
      ))}
    </div>
  );
}

type SavedView = {
  id: string;
  name: string;
  model: string;
  params: Pick<ListParams, "filters" | "filterMode" | "sort" | "visibleColumns" | "pageSize" | "searchText">;
  createdAt: number;
};

const SAVED_VIEWS_KEY = "admin.dataManager.savedViews.v1";

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedView[];
  } catch {
    return [];
  }
}

function saveSavedViews(views: SavedView[]) {
  localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
}

function QuerySummary({ params }: { params: ListParams }) {
  const filterCount = params.filters.filter((f) => f.field && f.op).length;
  const mode = params.filterMode === "any" ? "Any (OR)" : "All (AND)";
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
      <Badge variant="outline">{params.model}</Badge>
      {params.searchText ? <Badge>Search: “{params.searchText}”</Badge> : <Badge>Search: —</Badge>}
      <Badge>
        Filters: {filterCount} • {mode}
      </Badge>
      <Badge>
        Sort: {params.sort ? `${params.sort.field} ${params.sort.dir}` : "—"}
      </Badge>
      <Badge>Columns: {params.visibleColumns.length}</Badge>
      <Badge>
        Page: {params.page} / Size: {params.pageSize}
      </Badge>
    </div>
  );
}

const OP_HELP: Record<Operator, string> = {
  eq: "برابر است با مقدار واردشده.",
  neq: "برابر نیست با مقدار واردشده.",
  contains: "شامل مقدار (جستجوی بخشی از متن).",
  notContains: "شامل مقدار نیست (حتی اگر مقدار فقط فاصله باشد).",
  startsWith: "با مقدار شروع می‌شود.",
  gt: "بزرگ‌تر از مقدار.",
  gte: "بزرگ‌تر یا مساوی مقدار.",
  lt: "کوچک‌تر از مقدار.",
  lte: "کوچک‌تر یا مساوی مقدار.",
  isEmpty: "خالی است (null یا رشته خالی).",
  isNotEmpty: "خالی نیست (نه null و نه رشته خالی).",
  in: "مقدار داخل لیست است (برای چند مقدار: با کاما جدا کنید).",
  notIn: "مقدار داخل لیست نیست (برای چند مقدار: با کاما جدا کنید).",
};

function OperatorSelect({
  value,
  options,
  onChange,
}: {
  value: Operator;
  options: Operator[];
  onChange: (op: Operator) => void;
}) {
  const [open, setOpen] = useState(false);
  const [helpFor, setHelpFor] = useState<Operator | null>(null);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{value}</span>
        <Icon name="chevron" className="opacity-70" />
      </button>

      {open ? (
        <div role="menu" className="absolute z-30 mt-2 w-full rounded-md border border-neutral-200 bg-white p-1 shadow-lg">
          {options.map((op) => {
            const active = op === value;
            const expanded = helpFor === op;
            return (
              <div key={op} className="rounded-md">
                <div className={cn("flex items-center justify-between gap-2 rounded px-2 py-1", active && "bg-neutral-50")}>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm text-neutral-900 hover:underline"
                    onClick={() => {
                      onChange(op);
                      setHelpFor(null);
                      setOpen(false);
                    }}
                    role="menuitem"
                  >
                    {op}
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded border text-xs",
                      expanded ? "border-neutral-300 bg-neutral-100 text-neutral-900" : "border-neutral-200 bg-white text-neutral-700",
                    )}
                    onClick={() => setHelpFor((cur) => (cur === op ? null : op))}
                    aria-label={`Help for ${op}`}
                  >
                    ?
                  </button>
                </div>
                {expanded ? <div className="px-2 pb-2 text-xs text-neutral-700">{OP_HELP[op]}</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  const { toasts, push } = useToasts();

  const [registry, setRegistry] = useState<PrismaRegistry>(prismaRegistry);
  const [registrySource, setRegistrySource] = useState<"embedded" | "api">("embedded");

  const [modelName, setModelName] = useState<string>(() => prismaRegistry.models[0]?.name ?? "");

  const model = useMemo(
    () => registry.models.find((m) => m.name === modelName) ?? null,
    [registry.models, modelName],
  );

  useEffect(() => {
    if (!modelName && registry.models[0]?.name) setModelName(registry.models[0].name);
  }, [registry.models, modelName]);

  const scalarAndEnumFields = useMemo(() => {
    if (!model) return [];
    return model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
  }, [model]);

  const filterableFields = useMemo(() => {
    if (!model) return [];
    return model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
  }, [model]);

  const defaultVisibleColumns = useMemo(() => {
    if (!model) return [];
    const preferred = model.displayFields?.filter((n) => model.fields.some((f) => f.name === n)) ?? [];
    const pk = model.primaryKey ? [model.primaryKey] : [];
    const rest = model.fields
      .filter((f) => (f.kind === "scalar" || f.kind === "enum") && !preferred.includes(f.name) && !pk.includes(f.name))
      .slice(0, 6)
      .map((f) => f.name);
    return Array.from(new Set([...pk, ...preferred, ...rest]));
  }, [model]);

  const [draftSearchText, setDraftSearchText] = useState("");
  const debouncedSearch = useDebouncedValue(draftSearchText, 420);

  const [draftFilters, setDraftFilters] = useState<Filter[]>([]);
  const [draftFilterMode, setDraftFilterMode] = useState<FilterMode>("all");
  const [draftSort, setDraftSort] = useState<Sort | undefined>(undefined);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[]>([]);
  const [draftPageSize, setDraftPageSize] = useState<number>(20);

  const [appliedParams, setAppliedParams] = useState<ListParams | null>(null);
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  const pkField = useMemo(() => {
    if (!model) return null;
    return model.fields.find((f) => f.name === model.primaryKey) ?? null;
  }, [model]);

  const applied = useMemo(() => {
    if (!model) return null;
    return (
      appliedParams ?? {
        model: model.name,
        searchText: debouncedSearch || undefined,
        filters: draftFilters,
        filterMode: draftFilterMode,
        sort: draftSort,
        page,
        pageSize: draftPageSize,
        visibleColumns: draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns,
      }
    );
  }, [
    appliedParams,
    model,
    debouncedSearch,
    draftFilters,
    draftFilterMode,
    draftSort,
    page,
    draftPageSize,
    draftVisibleColumns,
    defaultVisibleColumns,
  ]);

  useEffect(() => {
    if (!model) return;
    const firstField = (model.fields.find((f) => f.kind === "scalar" || f.kind === "enum")?.name ?? "") as string;
    const firstMeta = model.fields.find((f) => f.name === firstField) ?? null;
    const firstOps = firstMeta ? operatorOptionsForField(firstMeta, registry.enums) : (["eq"] as Operator[]);
    const defaultFilterRow: Filter[] = firstField ? [{ field: firstField, op: firstOps[0] ?? "eq", value: "" }] : [];

    setDraftFilters([]);
    setDraftSort(undefined);
    setDraftSearchText("");
    setDraftVisibleColumns(defaultVisibleColumns);
    setDraftPageSize(50);
    setPage(1);
    setDraftFilters(defaultFilterRow);
    setDraftFilterMode("all");
    setAppliedParams({
      model: model.name,
      searchText: undefined,
      filters: [],
      filterMode: "all",
      sort: undefined,
      page: 1,
      pageSize: 50,
      visibleColumns: defaultVisibleColumns,
    });
  }, [model?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await apiGet<PrismaRegistry>("/api/admin/meta/models");
        if (!meta?.models) return;
        if (cancelled) return;
        setRegistry(meta);
        setRegistrySource("api");
      } catch {
        setRegistry(prismaRegistry);
        setRegistrySource("embedded");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchList(params: ListParams) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<ListResponse>("/api/admin/data/list", params);
      setRows(Array.isArray(res.rows) ? res.rows : []);
      setTotal(typeof res.total === "number" ? res.total : 0);
      setApiOnline(true);
    } catch (e: unknown) {
      setApiOnline(false);
      setError(getErrorMessage(e));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!applied || !model) return;
    fetchList(applied).catch(() => {});
  }, [applied?.model, applied?.searchText, JSON.stringify(applied?.filters), JSON.stringify(applied?.sort), applied?.page, applied?.pageSize, JSON.stringify(applied?.visibleColumns)]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / (applied?.pageSize ?? 20))), [total, applied?.pageSize]);

  useEffect(() => {
    if (!applied) return;
    if (page !== applied.page) setAppliedParams((p) => (p ? { ...p, page } : p));
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  function getRowId(row: Row) {
    const pk = model?.primaryKey;
    const v = pk ? row?.[pk] : undefined;
    return v === null || v === undefined ? "" : String(v);
  }

  function toggleRowSelected(row: Row, checked: boolean) {
    const id = getRowId(row);
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const r of rows) {
          const id = getRowId(r);
          if (id) next.add(id);
        }
      } else {
        for (const r of rows) {
          const id = getRowId(r);
          if (id) next.delete(id);
        }
      }
      return next;
    });
  }

  const allVisibleSelected = useMemo(() => {
    if (!rows.length) return false;
    let count = 0;
    for (const r of rows) {
      const id = getRowId(r);
      if (id && selectedIds.has(id)) count++;
    }
    return count > 0 && count === rows.filter((r) => !!getRowId(r)).length;
  }, [rows, selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const someVisibleSelected = useMemo(() => {
    if (!rows.length) return false;
    let count = 0;
    for (const r of rows) {
      const id = getRowId(r);
      if (id && selectedIds.has(id)) count++;
    }
    return count > 0 && !allVisibleSelected;
  }, [rows, selectedIds, allVisibleSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  const [viewRow, setViewRow] = useState<Row | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [savedViewsOpen, setSavedViewsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);

  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editableFields = useMemo(() => {
    if (!model) return [];
    return scalarAndEnumFields.filter((f) => !isAutoManagedUpdatedAt(f) && !isAutoManagedCreatedAt(f));
  }, [model, scalarAndEnumFields]);

  function buildInitialValues(mode: "create" | "edit" | "view", row?: Row) {
    const init: Record<string, unknown> = {};
    const errs: Record<string, string> = {};
    for (const f of editableFields) {
      if (mode === "create" && f.isId && f.hasDefaultValue) continue;
      if (mode !== "create" && f.isId) {
        init[f.name] = row?.[f.name] ?? null;
        continue;
      }
      const v = row?.[f.name];
      if (f.kind === "scalar" && f.type === "DateTime" && !f.isList) init[f.name] = datetimeLocalFromIso(v);
      else if (Array.isArray(v) && f.isList && f.type === "String") init[f.name] = v.join(", ");
      else if (f.kind === "scalar" && f.type === "Json") init[f.name] = v ? JSON.stringify(v, null, 2) : "";
      else if (typeof v === "boolean") init[f.name] = v;
      else init[f.name] = v ?? "";
    }
    setFormErrors(errs);
    setFormValues(init);
  }

  function openCreate() {
    setEditRow(null);
    setNewOpen(true);
    buildInitialValues("create");
  }

  function openEdit(row: Row) {
    setNewOpen(false);
    setEditRow(row);
    buildInitialValues("edit", row);
  }

  async function submitCreateOrUpdate() {
    if (!model) return;
    const mode: "create" | "edit" = editRow ? "edit" : "create";
    const errs: Record<string, string> = {};
    const data: Record<string, unknown> = {};

    for (const f of editableFields) {
      if (mode === "create" && f.isId && f.hasDefaultValue) continue;
      if (mode === "edit" && f.isId) continue;

      const raw = formValues[f.name];
      // Only enforce required on create. For edit, unchanged or omitted fields are allowed.
      if (mode === "create" && f.isRequired && (raw === "" || raw === null || raw === undefined)) {
        errs[f.name] = "این فیلد اجباری است.";
        continue;
      }

      if (mode === "edit") {
        const hasOriginal = Object.prototype.hasOwnProperty.call(editRow ?? {}, f.name);
        if (!hasOriginal && (raw === "" || raw === null || raw === undefined)) continue;

        const original = (editRow as Row | null)?.[f.name];
        let originalForm: unknown = original ?? "";
        if (f.kind === "scalar" && f.type === "DateTime" && !f.isList) originalForm = datetimeLocalFromIso(original);
        else if (Array.isArray(original) && f.isList && f.type === "String") originalForm = original.join(", ");
        else if (f.kind === "scalar" && f.type === "Json") originalForm = original ? JSON.stringify(original, null, 2) : "";
        else if (typeof original === "boolean") originalForm = original;
        else originalForm = original ?? "";

        if (String(raw ?? "") === String(originalForm ?? "")) continue;
      }

      const normalized = normalizeInputValue(f, raw);
      if (!normalized.ok) {
        errs[f.name] = normalized.error;
        continue;
      }
      if (normalized.value !== undefined) data[f.name] = normalized.value;
    }

    setFormErrors(errs);
    if (Object.keys(errs).length) {
      push({ type: "error", title: "خطا", description: "لطفاً خطاهای فرم را برطرف کنید." });
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        await apiPost<CreateUpdateResponse>("/api/admin/data/create", { model: model.name, data });
        push({ type: "success", title: "ایجاد شد" });
        setNewOpen(false);
      } else {
        const id = editRow?.[model.primaryKey];
        await apiPost<CreateUpdateResponse>("/api/admin/data/update", { model: model.name, id, data });
        push({ type: "success", title: "به‌روزرسانی شد" });
        setEditRow(null);
      }
      setSelectedIds(new Set());
      if (applied) await fetchList(applied);
    } catch (e: unknown) {
      push({ type: "error", title: "خطا", description: getErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteOne() {
    if (!model || !deleteRow) return;
    try {
      const id = deleteRow?.[model.primaryKey];
      await apiPost<ApiOk>("/api/admin/data/delete", { model: model.name, id });
      push({ type: "success", title: "حذف شد" });
      setDeleteRow(null);
      setSelectedIds(new Set());
      if (applied) await fetchList(applied);
    } catch (e: unknown) {
      push({ type: "error", title: "خطا", description: getErrorMessage(e) });
    }
  }

  async function confirmBulkDelete() {
    if (!model) return;
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      const res = await apiPost<BulkDeleteResponse>("/api/admin/data/bulkDelete", { model: model.name, ids });
      push({ type: "success", title: "حذف گروهی", description: `${res.deletedCount} ردیف حذف شد.` });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      if (applied) await fetchList(applied);
    } catch (e: unknown) {
      push({ type: "error", title: "خطا", description: getErrorMessage(e) });
    }
  }

  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);
  const autoAppliedRef = useRef(false);

  function createSavedView(name: string) {
    if (!applied) return;
    const view: SavedView = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      model: applied.model,
      params: {
        filters: applied.filters,
        filterMode: applied.filterMode,
        sort: applied.sort,
        visibleColumns: applied.visibleColumns,
        pageSize: applied.pageSize,
        searchText: applied.searchText,
      },
      createdAt: Date.now(),
    };
    const next = [view, ...savedViews];
    setSavedViews(next);
    saveSavedViews(next);
    push({ type: "success", title: "Saved view ذخیره شد" });
  }

  function applySavedView(v: SavedView) {
    applySavedViewInternal(v, { silent: false });
  }

  function applySavedViewInternal(v: SavedView, opts: { silent: boolean }) {
    if (!model || v.model !== model.name) {
      setModelName(v.model);
      // after model loads, apply will be possible; we store to localStorage temp.
      localStorage.setItem("admin.dataManager.pendingView", JSON.stringify(v));
      if (!opts.silent) push({ type: "success", title: "Saved view", description: "مدل تغییر کرد؛ view اعمال می‌شود." });
      setSavedViewsOpen(false);
      return;
    }
    setDraftFilters(v.params.filters ?? []);
    setDraftFilterMode(v.params.filterMode === "any" ? "any" : "all");
    setDraftSort(v.params.sort);
    setDraftVisibleColumns(v.params.visibleColumns ?? defaultVisibleColumns);
    setDraftPageSize(v.params.pageSize ?? 20);
    setDraftSearchText(v.params.searchText ?? "");
    setPage(1);
    setAppliedParams({
      model: model.name,
      searchText: v.params.searchText ?? undefined,
      filters: v.params.filters ?? [],
      filterMode: v.params.filterMode === "any" ? "any" : "all",
      sort: v.params.sort,
      page: 1,
      pageSize: v.params.pageSize ?? 20,
      visibleColumns: v.params.visibleColumns ?? defaultVisibleColumns,
    });
    setSavedViewsOpen(false);
    if (!opts.silent) push({ type: "success", title: "Saved view اعمال شد" });
  }

  useEffect(() => {
    if (!model) return;
    try {
      const raw = localStorage.getItem("admin.dataManager.pendingView");
      if (!raw) return;
      const v = JSON.parse(raw) as SavedView;
      if (v?.model === model.name) {
        localStorage.removeItem("admin.dataManager.pendingView");
        applySavedViewInternal(v, { silent: false });
      }
    } catch {
      localStorage.removeItem("admin.dataManager.pendingView");
    }
  }, [model?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoAppliedRef.current) return;
    if (!savedViews.length) return;
    const latest = [...savedViews].sort((a, b) => b.createdAt - a.createdAt)[0]!;
    autoAppliedRef.current = true;
    applySavedViewInternal(latest, { silent: true });
  }, [savedViews, model?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  function deleteSavedView(id: string) {
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    saveSavedViews(next);
    push({ type: "success", title: "Saved view حذف شد" });
  }

  const [newViewName, setNewViewName] = useState("");

  const [importText, setImportText] = useState("");
  const [importObjects, setImportObjects] = useState<Array<Record<string, unknown>>>([]);
  const [importKeys, setImportKeys] = useState<string[]>([]);
  const [importSelectedKeys, setImportSelectedKeys] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const operatorOptions = useMemo(() => {
    const map: Record<string, Operator[]> = {};
    for (const f of filterableFields) map[f.name] = operatorOptionsForField(f, registry.enums);
    return map;
  }, [filterableFields, registry.enums]);

  const fieldByName = useMemo(() => {
    const map = new Map<string, PrismaField>();
    for (const f of model?.fields ?? []) map.set(f.name, f);
    return map;
  }, [model]);

  async function findExistingIdByUnique(row: Record<string, unknown>) {
    if (!model) return null;
    const pk = model.primaryKey;
    const uniqueFields = (model.fields ?? []).filter(
      (f) => (f.kind === "scalar" || f.kind === "enum") && !f.isList && !f.isId && f.isUnique,
    );
    const usable = uniqueFields.filter((f) => row[f.name] !== undefined && row[f.name] !== null && row[f.name] !== "");
    if (!usable.length) return null;
    const filters: Filter[] = usable.map((f) => ({ field: f.name, op: "eq", value: row[f.name] }));
    const res = await apiPost<ListResponse>("/api/admin/data/list", {
      model: model.name,
      filters,
      page: 1,
      pageSize: 1,
      visibleColumns: [pk],
    } satisfies ListParams);
    const first = res.rows?.[0] as Row | undefined;
    const id = first?.[pk];
    return id ?? null;
  }

  function parseImportJson(text: string) {
    setImportError(null);
    setImportSelectedKeys(new Set());
    setImportObjects([]);
    setImportKeys([]);
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const objs = arr.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
      if (!objs.length) {
        setImportError("JSON باید یک object یا آرایه‌ای از object باشد.");
        return;
      }
      setImportObjects(objs);
      if (!model) return;
      const allowed = new Set(
        model.fields
          .filter((f) => f.kind === "scalar" || f.kind === "enum")
          .map((f) => f.name),
      );
      const keys = new Set<string>();
      for (const o of objs) Object.keys(o).forEach((k) => allowed.has(k) && keys.add(k));
      const list = Array.from(keys);
      list.sort((a, b) => a.localeCompare(b));
      setImportKeys(list);
    } catch {
      setImportError("JSON معتبر نیست.");
    }
  }

  async function runImport() {
    if (!model) return;
    if (!importObjects.length) {
      push({ type: "error", title: "خطا", description: "ابتدا JSON را وارد کنید." });
      return;
    }
    setImporting(true);
    const pk = model.primaryKey;
    const selected = importSelectedKeys;
    const editable = new Set(model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name));

    const normalizeRow = (
      mode: "create" | "update" | "match",
      row: Record<string, unknown>,
      keys: string[],
    ): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } => {
      const data: Record<string, unknown> = {};
      for (const key of keys) {
        if (!editable.has(key)) continue;
        if (mode === "create" && key === pk && pkField?.hasDefaultValue) continue;
        if (mode !== "match" && mode === "update" && key === pk) continue;
        const field = fieldByName.get(key);
        if (!field) continue;
        const raw = row[key];
        const normalized = normalizeInputValue(field, raw);
        if (!normalized.ok) return { ok: false, error: `${key}: ${normalized.error}` };
        data[key] = normalized.value;
      }
      return { ok: true, data };
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let idx = 0; idx < importObjects.length; idx++) {
      const rowObj = importObjects[idx]!;
      try {
        const idFromJson = rowObj[pk];
        let idToUpdate: unknown | null = idFromJson ?? null;

        if (idToUpdate === null || idToUpdate === undefined || idToUpdate === "") {
          // Optional: try to match by unique fields for update.
          idToUpdate = await findExistingIdByUnique(rowObj);
        }

        if (idToUpdate !== null && idToUpdate !== undefined && idToUpdate !== "") {
          const keys = Array.from(selected);
          if (!keys.length) {
            skipped++;
            continue;
          }
          const normalized = normalizeRow("update", rowObj, keys);
          if (!normalized.ok) {
            errors.push(`#${idx + 1} ${normalized.error}`);
            continue;
          }
          await apiPost<CreateUpdateResponse>("/api/admin/data/update", {
            model: model.name,
            id: idToUpdate,
            data: normalized.data,
          });
          updated++;
        } else {
          const keys = importKeys.filter((k) => k !== pk);
          const normalized = normalizeRow("create", rowObj, keys);
          if (!normalized.ok) {
            errors.push(`#${idx + 1} ${normalized.error}`);
            continue;
          }
          await apiPost<CreateUpdateResponse>("/api/admin/data/create", { model: model.name, data: normalized.data });
          created++;
        }
      } catch (e: unknown) {
        errors.push(`#${idx + 1} ${getErrorMessage(e)}`);
      }
    }

    setImporting(false);
    if (errors.length) {
      push({
        type: "error",
        title: "Import با خطا",
        description: `${created} created • ${updated} updated • ${skipped} skipped • ${errors.length} errors`,
      });
    } else {
      push({ type: "success", title: "Import موفق", description: `${created} created • ${updated} updated • ${skipped} skipped` });
    }
    setImportOpen(false);
    setImportText("");
    setImportObjects([]);
    setImportKeys([]);
    setImportSelectedKeys(new Set());
    setImportError(null);
    if (applied) await fetchList(applied);
  }

  function addFilterRow() {
    const firstField = filterableFields[0]?.name ?? "";
    const firstOp = firstField ? operatorOptions[firstField]?.[0] ?? "eq" : "eq";
    setDraftFilters((prev) => [...prev, { field: firstField, op: firstOp, value: "" }]);
  }

  function normalizeFiltersForApply(filters: Filter[]) {
    return (filters ?? [])
      .filter((f) => f.field && f.op)
      .filter(
        (f) =>
          f.op === "isEmpty" ||
          f.op === "isNotEmpty" ||
          !(f.value === "" || f.value === null || f.value === undefined),
      );
  }

  function updateFilter(i: number, patch: Partial<Filter>) {
    setDraftFilters((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFilter(i: number) {
    setDraftFilters((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length) return next;
      const firstField = filterableFields[0]?.name ?? "";
      const firstOp = firstField ? operatorOptions[firstField]?.[0] ?? "eq" : "eq";
      return firstField ? [{ field: firstField, op: firstOp, value: "" }] : [];
    });
  }

  function applyQuery() {
    if (!model) return;
    setPage(1);
    setAppliedParams({
      model: model.name,
      searchText: debouncedSearch || undefined,
      filters: normalizeFiltersForApply(draftFilters),
      filterMode: draftFilterMode,
      sort: draftSort,
      page: 1,
      pageSize: draftPageSize,
      visibleColumns: draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns,
    });
    setSelectedIds(new Set());
  }

  function applyVisibleColumns(nextColumns: string[]) {
    if (!model) return;
    const cleaned = nextColumns.length ? nextColumns : defaultVisibleColumns;
    setDraftVisibleColumns(cleaned);
    setPage(1);
    setAppliedParams((prev) => ({
      model: model.name,
      searchText: (prev?.searchText ?? debouncedSearch) || undefined,
      filters: prev?.filters ?? draftFilters.filter((f) => f.field && f.op),
      filterMode: prev?.filterMode ?? draftFilterMode,
      sort: prev?.sort ?? draftSort,
      page: 1,
      pageSize: prev?.pageSize ?? draftPageSize,
      visibleColumns: cleaned,
    }));
    setSelectedIds(new Set());
  }

  function resetQuery() {
    if (!model) return;
    setDraftSearchText("");
    const firstField = filterableFields[0]?.name ?? "";
    const firstOp = firstField ? operatorOptions[firstField]?.[0] ?? "eq" : "eq";
    setDraftFilters(firstField ? [{ field: firstField, op: firstOp, value: "" }] : []);
    setDraftFilterMode("all");
    setDraftSort(undefined);
    setDraftVisibleColumns(defaultVisibleColumns);
    setDraftPageSize(50);
    setPage(1);
    setAppliedParams({
      model: model.name,
      searchText: undefined,
      filters: [],
      filterMode: "all",
      sort: undefined,
      page: 1,
      pageSize: 50,
      visibleColumns: defaultVisibleColumns,
    });
    setSelectedIds(new Set());
  }

  const columns = useMemo(() => {
    if (!model || !applied) return [];
    const valid = new Set(model.fields.map((f) => f.name));
    return (applied.visibleColumns ?? []).filter((c) => valid.has(c));
  }, [model, applied]);

  const draftVisibleCols = useMemo(
    () => (draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns),
    [draftVisibleColumns, defaultVisibleColumns],
  );
  const draftNormalizedFilters = useMemo(() => normalizeFiltersForApply(draftFilters), [draftFilters]);
  const isQueryDirty = useMemo(() => {
    if (!applied || !model) return false;
    const sortA = applied.sort ? JSON.stringify(applied.sort) : "";
    const sortD = draftSort ? JSON.stringify(draftSort) : "";
    const colsA = JSON.stringify(applied.visibleColumns ?? []);
    const colsD = JSON.stringify(draftVisibleCols ?? []);
    const filtersA = JSON.stringify(applied.filters ?? []);
    const filtersD = JSON.stringify(draftNormalizedFilters ?? []);
    const searchA = applied.searchText ?? "";
    const searchD = debouncedSearch ?? "";
    const modeA = applied.filterMode === "any" ? "any" : "all";
    const modeD = draftFilterMode;
    return (
      searchA !== searchD ||
      sortA !== sortD ||
      colsA !== colsD ||
      filtersA !== filtersD ||
      modeA !== modeD ||
      Number(applied.pageSize) !== Number(draftPageSize)
    );
  }, [applied, model, debouncedSearch, draftSort, draftVisibleCols, draftNormalizedFilters, draftPageSize, draftFilterMode]);

  const isDirtyExcludingSearchSort = useMemo(() => {
    if (!applied || !model) return false;
    const colsA = JSON.stringify(applied.visibleColumns ?? []);
    const colsD = JSON.stringify(draftVisibleCols ?? []);
    const filtersA = JSON.stringify(applied.filters ?? []);
    const filtersD = JSON.stringify(draftNormalizedFilters ?? []);
    const modeA = applied.filterMode === "any" ? "any" : "all";
    const modeD = draftFilterMode;
    return colsA !== colsD || filtersA !== filtersD || modeA !== modeD || Number(applied.pageSize) !== Number(draftPageSize);
  }, [applied, model, draftVisibleCols, draftNormalizedFilters, draftPageSize, draftFilterMode]);

  useEffect(() => {
    if (!model || !applied) return;
    // Auto-apply search/sort changes only when other parts aren't pending apply.
    if (isDirtyExcludingSearchSort) return;
    const nextSearch = debouncedSearch || undefined;
    const nextSort = draftSort;
    const sameSearch = (applied.searchText ?? undefined) === nextSearch;
    const sameSort = JSON.stringify(applied.sort ?? null) === JSON.stringify(nextSort ?? null);
    if (sameSearch && sameSort) return;

    setPage(1);
    setAppliedParams((prev) => ({
      model: model.name,
      searchText: nextSearch,
      filters: prev?.filters ?? [],
      filterMode: prev?.filterMode ?? draftFilterMode,
      sort: nextSort,
      page: 1,
      pageSize: prev?.pageSize ?? draftPageSize,
      visibleColumns: prev?.visibleColumns ?? draftVisibleCols,
    }));
    setSelectedIds(new Set());
  }, [debouncedSearch, draftSort, isDirtyExcludingSearchSort]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentViewFingerprint = useMemo(() => {
    if (!applied) return "";
    return JSON.stringify({
      model: applied.model,
      searchText: applied.searchText ?? "",
      filters: applied.filters ?? [],
      filterMode: applied.filterMode === "any" ? "any" : "all",
      sort: applied.sort ?? null,
      pageSize: applied.pageSize,
      visibleColumns: applied.visibleColumns ?? [],
    });
  }, [applied]);

  const currentViewIsSaved = useMemo(() => {
    if (!currentViewFingerprint) return false;
    return savedViews.some((v) => {
      const fp = JSON.stringify({
        model: v.model,
        searchText: v.params.searchText ?? "",
        filters: v.params.filters ?? [],
        filterMode: v.params.filterMode === "any" ? "any" : "all",
        sort: v.params.sort ?? null,
        pageSize: v.params.pageSize ?? 20,
        visibleColumns: v.params.visibleColumns ?? [],
      });
      return fp === currentViewFingerprint;
    });
  }, [savedViews, currentViewFingerprint]);

  async function copyVisibleJson(opts: { compact: boolean }) {
    if (copyBusy) return;
    if (!model) return;
    try {
      const cols = Array.from(new Set(columns));
      const payload = rows.map((r) => {
        const obj: Record<string, unknown> = {};
        for (const c of cols) obj[c] = r?.[c];
        return obj;
      });
      const text = opts.compact ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(text);
      push({ type: "success", title: "کپی شد", description: `JSON (${payload.length} rows) در کلیپ‌بورد کپی شد.` });
      setCopyBusy(true);
      window.setTimeout(() => setCopyBusy(false), 2500);
    } catch {
      push({ type: "error", title: "خطا", description: "امکان کپی در کلیپ‌بورد نیست." });
      setCopyBusy(false);
    }
  }

  const canRender = !!model;

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-0">
        <div className="flex flex-col gap-4">
          <div className="-mt-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-3">
                <div className="text-sm font-semibold text-neutral-900">Data Manager</div>
                <div className="hidden h-4 w-px bg-neutral-200 sm:block" />
                <div className="text-xs text-neutral-500">
                  Registry: {registrySource === "api" ? "API" : "Embedded"} • API:{" "}
                  {apiOnline === null ? "—" : apiOnline ? "Online" : "Offline"}
                </div>
                <div className="hidden h-4 w-px bg-neutral-200 sm:block" />
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-neutral-900">Model/Table</div>
                  <div className="w-56">
                    <Select
                      value={modelName}
                      onChange={(v) => setModelName(v)}
                      options={registry.models.map((m) => ({ value: m.name, label: m.name }))}
                      placeholder={registry.models.length ? "Select model" : "No models in registry"}
                      disabled={!registry.models.length}
                    />
                  </div>
                </div>
              </div>

	              <div className="flex flex-wrap items-center justify-end gap-2">
	                <div className="flex flex-wrap items-center gap-2">
	                  <Button size="sm" onClick={openCreate} disabled={!canRender}>
	                    <Icon name="plus" />
	                    New
	                  </Button>
	                  <Button size="sm" variant="outline" onClick={() => setExportOpen(true)} disabled={!rows.length}>
	                    <Icon name="download" />
	                    Export
	                  </Button>
	                  <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} disabled={!canRender}>
	                    Import
	                  </Button>
	                  <Button
	                    size="sm"
	                    variant="outline"
	                    className={cn(
	                      "!border-emerald-200 !bg-emerald-50 !text-emerald-900 hover:!bg-emerald-100",
	                      currentViewIsSaved && "opacity-60",
	                    )}
	                    onClick={() => {
	                      if (!applied || currentViewIsSaved) return;
	                      const name = `${applied.model} • ${new Date().toLocaleString()}`;
	                      createSavedView(name);
	                    }}
	                    disabled={!canRender || !applied || currentViewIsSaved}
	                    title={currentViewIsSaved ? "این View قبلاً ذخیره شده است." : "ذخیره‌ی View فعلی"}
	                  >
	                    Save View
	                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSavedViewsOpen(true)} disabled={!canRender}>
                    Saved Views
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetQuery}
                    disabled={!canRender}
                    className="border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                    title="Reset filters, sort, search, columns, and page size"
                  >
                    Reset
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => applied && fetchList(applied)} disabled={!canRender || loading}>
                    <Icon name="refresh" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold text-neutral-900">Query Builder</div>
                {applied ? <QuerySummary params={applied} /> : null}
              </div>
            </CardHeader>
            <CardContent>
              {!canRender ? (
                <div className="text-sm text-neutral-700">هیچ مدلی در registry موجود نیست. /api/admin/meta/models را پیاده‌سازی کنید یا prismaRegistry را پر کنید.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_2fr_1.3fr] md:items-start">
                    <div className="md:pr-2">
                      <div className="mb-1 text-xs text-neutral-600">Global Search</div>
                      <Input value={draftSearchText} onChange={(e) => setDraftSearchText(e.target.value)} placeholder="Search…" />
                      <div className="mt-1 text-[11px] text-neutral-500">Debounced: {debouncedSearch ? `“${debouncedSearch}”` : "—"}</div>
                    </div>

                    <div className="md:pl-2">
                      <div className="mb-1 text-xs font-semibold text-neutral-700">Sort</div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <Select
                          value={draftSort?.field ?? ""}
                          onChange={(v) => setDraftSort(v ? { field: v, dir: draftSort?.dir ?? "asc" } : undefined)}
                          options={scalarAndEnumFields.map((f) => ({ value: f.name, label: f.name }))}
                          placeholder="No sort"
                        />
                        <Select
                          value={draftSort?.dir ?? "asc"}
                          onChange={(v) =>
                            setDraftSort((s) =>
                              s
                                ? { ...s, dir: v as "asc" | "desc" }
                                : { field: scalarAndEnumFields[0]?.name ?? "", dir: v as "asc" | "desc" },
                            )
                          }
                          options={[
                            { value: "asc", label: "asc" },
                            { value: "desc", label: "desc" },
                          ]}
                          disabled={!draftSort?.field}
                        />
                        <Button variant="outline" onClick={() => setDraftSort(undefined)} disabled={!draftSort}>
                          Clear
                        </Button>
                      </div>
                    </div>

	                    <div className="flex flex-col justify-end gap-2">
	                      <div className="text-xs font-semibold text-neutral-700">Filters</div>
	                      <div className="grid grid-cols-[minmax(220px,1fr)_auto_auto] items-center gap-2">
	                        <div className="min-w-[220px]">
	                          <Select
	                            value={draftFilterMode}
	                            onChange={(v) => setDraftFilterMode((v === "any" ? "any" : "all") as FilterMode)}
	                            options={[
	                              { value: "all", label: "Match: All (AND)" },
	                              { value: "any", label: "Match: Any (OR)" },
	                            ]}
	                          />
	                        </div>
	                        <Button variant="outline" size="sm" onClick={addFilterRow} className="h-8 px-2">
	                          <Icon name="plus" />
	                          Add
	                        </Button>
	                        <Button
	                          size="sm"
	                          onClick={applyQuery}
	                          disabled={!canRender || !isQueryDirty}
	                          className="h-8 bg-indigo-600 px-3 text-white hover:bg-indigo-700"
	                        >
	                          Apply
	                        </Button>
	                      </div>
	                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {draftFilters.map((f, i) => {
                        const fieldMeta = filterableFields.find((x) => x.name === f.field) ?? null;
                        const allOps = fieldMeta ? operatorOptionsForField(fieldMeta, registry.enums) : (["eq"] as Operator[]);
                        const isCrossTableOp = f.op === "existsIn" || f.op === "notExistsIn";
                        const isOpNoValue = f.op === "isEmpty" || f.op === "isNotEmpty";
                        const isLengthOp = isLengthOperator(f.op);
                        const supportsLengthMode =
                          fieldMeta?.kind === "scalar" && fieldMeta.type === "String" && !fieldMeta.isList;
                        const filterMode = supportsLengthMode && isLengthOp ? "length" : "value";
                        const ops =
                          supportsLengthMode && filterMode === "length"
                            ? (["lenEq", "lenGt", "lenGte", "lenLt", "lenLte"] as Operator[])
                            : allOps.filter((op) => !isLengthOperator(op));
                        const isBoolean = fieldMeta?.kind === "scalar" && fieldMeta.type === "Boolean" && !fieldMeta.isList;
                        const isEnum = fieldMeta?.kind === "enum" || (!!fieldMeta && !isScalarType(fieldMeta.type) && !!registry.enums[fieldMeta.type]);
                        const isDateTime = fieldMeta?.kind === "scalar" && fieldMeta.type === "DateTime" && !fieldMeta.isList;
                        const enumValues = isEnum && fieldMeta ? registry.enums[String(fieldMeta.type)] ?? [] : [];

                        return (
                          <div
                            key={i}
                            className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-2 md:flex-row md:flex-nowrap md:items-center"
                          >
                            <div className="md:w-[240px] md:flex-none">
                              <Select
                                value={f.field}
                                onChange={(v) => {
                                  const nextField = filterableFields.find((x) => x.name === v);
                                  const nextOps = nextField ? operatorOptionsForField(nextField, registry.enums) : (["eq"] as Operator[]);
                                  updateFilter(i, { field: v, op: nextOps[0] ?? "eq", value: "" });
                                }}
                                options={filterableFields.map((ff) => ({ value: ff.name, label: ff.name }))}
                              />
                            </div>
                            <div className={supportsLengthMode ? "md:w-[160px] md:flex-none" : "md:w-[1px] md:flex-none"}>
                              {supportsLengthMode ? (
                                <Select
                                  value={filterMode}
                                  onChange={(mode) => {
                                    if (mode === "length") updateFilter(i, { op: "lenEq", value: "0" });
                                    else updateFilter(i, { op: "contains", value: "" });
                                  }}
                                  options={[
                                    { value: "value", label: "type: value" },
                                    { value: "length", label: "type: length" },
                                  ]}
                                />
                              ) : (
                                <div />
                              )}
                            </div>
                            <div className="md:w-[170px] md:flex-none">
                              <OperatorSelect
                                value={f.op}
                                options={ops}
                                onChange={(op) =>
                                  updateFilter(i, { op, value: op === "isEmpty" || op === "isNotEmpty" ? undefined : f.value ?? "" })
                                }
                              />
                            </div>
                            <div className="min-w-0 md:flex-1">
                              {isCrossTableOp ? (
                                (() => {
                                  const parsedRef = parseModelFieldRef(f.value);
                                  const modelName = parsedRef?.model ?? registry.models[0]?.name ?? "";
                                  const modelMeta = registry.models.find((m) => m.name === modelName) ?? null;
                                  const otherFields = (modelMeta?.fields ?? []).filter((ff) => ff.kind === "scalar" || ff.kind === "enum");
                                  const otherField =
                                    parsedRef?.field && otherFields.some((ff) => ff.name === parsedRef.field)
                                      ? parsedRef.field
                                      : otherFields[0]?.name ?? "";

                                  return (
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                      <Select
                                        value={modelName}
                                        onChange={(nextModel) => {
                                          const nextMeta = registry.models.find((m) => m.name === nextModel) ?? null;
                                          const nextFields = (nextMeta?.fields ?? []).filter(
                                            (ff) => ff.kind === "scalar" || ff.kind === "enum",
                                          );
                                          const nextField = nextFields[0]?.name ?? "";
                                          updateFilter(i, { value: nextField ? `${nextModel}.${nextField}` : `${nextModel}.` });
                                        }}
                                        options={registry.models.map((m) => ({ value: m.name, label: m.name }))}
                                        placeholder="Other model"
                                      />
                                      <Select
                                        value={otherField}
                                        onChange={(nextField) => updateFilter(i, { value: `${modelName}.${nextField}` })}
                                        options={otherFields.map((ff) => ({ value: ff.name, label: ff.name }))}
                                        placeholder="Other field"
                                        disabled={!modelName || otherFields.length === 0}
                                      />
                                    </div>
                                  );
                                })()
                              ) : isOpNoValue ? (
                                <div className="text-xs text-neutral-500">No value</div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    {isBoolean ? (
                                      <Select
                                        value={String(f.value ?? "")}
                                        onChange={(v) => updateFilter(i, { value: v })}
                                        options={[
                                          { value: "true", label: "true" },
                                          { value: "false", label: "false" },
                                        ]}
                                        placeholder="Select…"
                                      />
                                    ) : isEnum ? (
                                      <Select
                                        value={String(f.value ?? "")}
                                        onChange={(v) => updateFilter(i, { value: v })}
                                        options={enumValues.map((x) => ({ value: x, label: x }))}
                                        placeholder="Select…"
                                      />
                                    ) : isDateTime ? (
                                      <Input
                                        type="datetime-local"
                                        value={String(f.value ?? "")}
                                        onChange={(e) => updateFilter(i, { value: e.target.value })}
                                        placeholder="YYYY-MM-DDThh:mm"
                                      />
                                    ) : isLengthOp ? (
                                      <Input
                                        type="number"
                                        value={String(f.value ?? "")}
                                        onChange={(e) => updateFilter(i, { value: e.target.value })}
                                        placeholder="Length…"
                                      />
                                    ) : (
                                      <Input
                                        value={String(f.value ?? "")}
                                        onChange={(e) => updateFilter(i, { value: e.target.value })}
                                        placeholder="Value…"
                                      />
                                    )}
                                  </div>
                                  {fieldMeta ? (
                                    <Badge variant="outline" className="hidden md:inline-flex" title="Field type">
                                      {fieldMeta.kind}:{String(fieldMeta.type)}
                                      {fieldMeta.isList ? "[]" : ""}
                                    </Badge>
                                  ) : null}
                                </div>
                              )}
                            </div>
                            <div className="md:flex-none md:self-center">
                              <Button variant="ghost" size="icon" onClick={() => removeFilter(i)} aria-label="Remove filter">
                                <Icon name="trash" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-neutral-900">Table</div>
                  {error ? <Badge variant="outline">Error</Badge> : null}
                  {loading ? <Badge>Loading…</Badge> : null}
                  {!loading && !error ? <Badge variant="outline">{total} total</Badge> : null}
                </div>

	                <div className="flex flex-wrap items-center gap-2">
	                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-1">
	                    <div className="px-1 text-xs font-medium text-neutral-700">
	                      Page {page} / {totalPages}
	                    </div>
		                    <div className="flex items-center gap-1">
		                      <Button
		                        variant="outline"
		                        size="sm"
		                        onClick={() => setPage((p) => Math.max(1, p - 1))}
		                        disabled={page <= 1 || loading}
		                      >
		                        Prev
		                      </Button>
		                      <Button
		                        variant="outline"
		                        size="sm"
		                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
		                        disabled={page >= totalPages || loading}
		                      >
		                        Next
		                      </Button>
		                    </div>
		                  </div>

	                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-1">
	                    <div className="flex items-center gap-2 px-1">
	                      <div className="text-xs font-medium text-neutral-700">Page Size</div>
	                      <div className="w-24">
                        <Select
                          value={String(draftPageSize)}
                          onChange={(v) => {
                            const nextSize = Number(v);
                            setDraftPageSize(nextSize);
                            if (!model) return;
                            setPage(1);
	                            setAppliedParams((prev) => ({
	                              model: model.name,
	                              searchText: (prev?.searchText ?? debouncedSearch) || undefined,
	                              filters: prev?.filters ?? [],
	                              filterMode: prev?.filterMode ?? draftFilterMode,
	                              sort: prev?.sort,
	                              page: 1,
	                              pageSize: nextSize,
	                              visibleColumns: prev?.visibleColumns ?? (draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns),
	                            }));
                            setSelectedIds(new Set());
                          }}
                          options={[1, 5, 10, 20, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
                          className="bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-1">
                      <div className="px-2 text-xs font-medium text-emerald-900">
                        Copy JSON ({rows.length})
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyVisibleJson({ compact: false })}
                          disabled={!rows.length || copyBusy}
                          title="Copy pretty JSON"
                          className="!border-emerald-200 !bg-emerald-50 !text-emerald-900 hover:!bg-emerald-100"
                        >
                          <Icon name="braces" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => copyVisibleJson({ compact: true })}
                          disabled={!rows.length || copyBusy}
                          title="Copy compact JSON"
                          className="!border-emerald-200 !bg-emerald-50 !text-emerald-900 hover:!bg-emerald-100"
                        >
                          <Icon name="minify" />
                        </Button>
                      </div>
                    </div>
                    <DropdownMenu
                      trigger={({ open, setOpen }) => (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOpen(!open)}
                          disabled={!canRender}
                          className="border-sky-200 bg-white text-sky-700 hover:bg-sky-50"
                        >
                          Columns <Icon name="chevron" className="opacity-70" />
                        </Button>
                      )}
                    >
                      {({ close }) => (
                        <div className="max-h-64 overflow-auto p-1">
                        <div className="px-2 py-1 text-xs font-semibold text-neutral-700">Visible columns</div>
                        <div className="px-2 py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => applyVisibleColumns(defaultVisibleColumns)}
                            className="w-full justify-start"
                          >
                            Reset to default
                          </Button>
                        </div>
                        <Separator />
                        {scalarAndEnumFields.map((f) => {
                          const checked = (draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns).includes(f.name);
                          return (
                            <label key={f.name} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-neutral-50">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const current = draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns;
                                  const next = v ? Array.from(new Set([...current, f.name])) : current.filter((x) => x !== f.name);
                                  applyVisibleColumns(next);
                                }}
                                aria-label={`Toggle column ${f.name}`}
                              />
                              <span className="text-sm text-neutral-800">{f.name}</span>
                            </label>
                          );
                        })}
                        <div className="px-2 py-2">
                          <Button variant="outline" onClick={close} className="w-full">
                            Close
                          </Button>
                        </div>
                      </div>
                    )}
                  </DropdownMenu>

                  <DropdownMenu
                    trigger={({ open, setOpen }) => (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen(!open)}
                        disabled={!canRender}
                        className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
                      >
                        Column Order <Icon name="chevron" className="opacity-70" />
                      </Button>
                    )}
                  >
                    {({ close }) => (
                      <div className="max-h-72 overflow-auto p-1">
                        <div className="px-2 py-1 text-xs font-semibold text-neutral-700">Reorder visible columns</div>
                        <div className="px-2 pb-2 pt-1 text-[11px] text-neutral-500">
                          Drag to reorder. Changes apply instantly.
                        </div>
                        <div className="px-2 pb-2">
                          <ColumnOrderEditor
                            columns={(draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns).filter((c) =>
                              scalarAndEnumFields.some((f) => f.name === c),
                            )}
                            onReorder={(next) => {
                              const current = (draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns).filter((c) =>
                                scalarAndEnumFields.some((f) => f.name === c),
                              );
                              const extras = (draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns).filter(
                                (c) => !current.includes(c),
                              );
                              applyVisibleColumns([...next, ...extras]);
                            }}
                            onRemove={(col) => {
                              const current = draftVisibleColumns.length ? draftVisibleColumns : defaultVisibleColumns;
                              const next = current.filter((c) => c !== col);
                              applyVisibleColumns(next);
                            }}
                          />
                        </div>
                        <div className="px-2 py-2">
                          <Button variant="outline" onClick={close} className="w-full">
                            Close
                          </Button>
                        </div>
                      </div>
                    )}
                  </DropdownMenu>
                </div>

                <Button
                  variant="destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={!selectedCount || !canRender}
                    title={selectedCount ? `Delete ${selectedCount} selected` : "Select rows first"}
                    className="shadow-sm"
                  >
                    <Icon name="trash" />
                    Bulk Delete ({selectedCount})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

              <div className="overflow-auto rounded-md border border-neutral-200">
	                <table className="min-w-full border-collapse text-sm">
	                  <thead className="bg-neutral-50">
	                    <tr className="border-b border-neutral-200">
                      <th className="w-10 px-3 py-2 text-left">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={(v) => toggleAllVisible(v)}
                          aria-label="Select all visible rows"
                        />
                        {someVisibleSelected ? (
                          <span className="sr-only">(some selected)</span>
                        ) : null}
                      </th>
	                      {columns.map((c) => {
	                        const isSorted = draftSort?.field === c;
	                        const ariaSort = isSorted ? (draftSort?.dir === "asc" ? "ascending" : "descending") : "none";
	                        return (
	                          <th
	                            key={c}
	                            scope="col"
	                            aria-sort={ariaSort}
	                            className={cn(
	                              "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold",
	                              isSorted ? "text-neutral-900" : "text-neutral-700",
	                            )}
	                          >
	                            <button
	                              type="button"
	                              className={cn(
	                                "inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-neutral-100",
	                                isSorted && "bg-neutral-100",
	                              )}
	                              onClick={() => {
	                                setDraftSort((prev) => {
	                                  if (!prev || prev.field !== c) return { field: c, dir: "asc" };
	                                  if (prev.dir === "asc") return { field: c, dir: "desc" };
	                                  return undefined;
	                                });
	                                setPage(1);
	                              }}
	                              title="Sort"
	                            >
	                              <span>{c}</span>
	                              {isSorted ? (
	                                <Icon name={draftSort?.dir === "asc" ? "arrowUp" : "arrowDown"} className="h-3.5 w-3.5 opacity-70" />
	                              ) : (
	                                <Icon name="chevron" className="h-3.5 w-3.5 opacity-40" />
	                              )}
	                            </button>
	                          </th>
	                        );
	                      })}
	                      <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-700">Actions</th>
	                    </tr>
	                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-neutral-100">
                          <td className="px-3 py-2">
                            <div className="h-4 w-4 animate-pulse rounded bg-neutral-200" />
                          </td>
                          {columns.map((c) => (
                            <td key={c} className="px-3 py-2">
                              <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            <div className="ml-auto h-4 w-24 animate-pulse rounded bg-neutral-200" />
                          </td>
                        </tr>
                      ))
                    ) : rows.length ? (
                      rows.map((r, idx) => {
                        const id = getRowId(r);
                        const selected = id ? selectedIds.has(id) : false;
                        const label = model?.displayFields?.map((f) => formatCellValue(r?.[f])).filter((x) => x !== "—").join(" • ");
                        return (
                          <tr key={id || idx} className={cn("border-b border-neutral-100 hover:bg-neutral-50", selected && "bg-neutral-50")}>
                            <td className="px-3 py-2">
                              <Checkbox checked={selected} onCheckedChange={(v) => toggleRowSelected(r, v)} aria-label={`Select row ${id || idx}`} />
                            </td>
                            {columns.map((c) => (
                              <td key={c} className="max-w-[320px] truncate px-3 py-2 text-neutral-800" title={String(formatCellValue(r?.[c]))}>
                                {formatCellValue(r?.[c])}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setViewRow(r)} aria-label="View" title={label || "View"}>
                                  <Icon name="eye" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Edit">
                                  <Icon name="edit" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteRow(r)} aria-label="Delete">
                                  <Icon name="trash" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-sm text-neutral-600">
                          Empty.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-neutral-600">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1 || loading}>
                    First
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    Next
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading}>
                    Last
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!viewRow}
        onOpenChange={(v) => (v ? null : setViewRow(null))}
        title={model ? `View ${model.name}` : "View"}
        widthClass="max-w-3xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </div>
        }
      >
        {!model || !viewRow ? null : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {model.fields.map((f) => (
              <div key={f.name} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-neutral-700">{f.name}</div>
                  {f.isId ? <Badge variant="outline">PK</Badge> : null}
                </div>
                <div className="mt-1 text-sm text-neutral-900">{formatCellValue(viewRow?.[f.name])}</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {f.kind}:{String(f.type)}
                  {f.isList ? "[]" : ""} {f.isRequired ? "• required" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog
        open={newOpen || !!editRow}
        onOpenChange={(v) => {
          if (!v) {
            setNewOpen(false);
            setEditRow(null);
          }
        }}
        title={model ? (editRow ? `Edit ${model.name}` : `New ${model.name}`) : editRow ? "Edit" : "New"}
        widthClass="max-w-3xl"
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-500">{pkField ? `Primary key: ${pkField.name}` : ""}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => (setNewOpen(false), setEditRow(null))} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submitCreateOrUpdate} disabled={saving || !model}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        }
      >
        {!model ? null : (
          <div className="grid grid-cols-1 gap-4">
            <div className="text-xs text-neutral-600">
              Only scalar + enum fields are editable. Relations are not edited. Decimal/BigInt are sent as string. JSON requires valid JSON.
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {editableFields.map((f) => {
                const isEdit = !!editRow;
                const isPkReadOnly = !!(isEdit && f.isId);
                const hideInCreate = !!(!isEdit && f.isId && f.hasDefaultValue);
                if (hideInCreate) return null;

                const val = formValues[f.name];
                const err = formErrors[f.name];
                const showRequiredStar = !isEdit && f.isRequired && !f.hasDefaultValue && !f.isId;
                const baseLabel = (
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-xs font-semibold text-neutral-700">
                      {f.name} {showRequiredStar ? <span className="text-red-600">*</span> : null}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {f.kind}:{String(f.type)}
                      {f.isList ? "[]" : ""}
                    </div>
                  </div>
                );

                const setValue = (v: unknown) => setFormValues((prev) => ({ ...prev, [f.name]: v }));

                const isEnum = f.kind === "enum" || (!!registry.enums[String(f.type)] && !isScalarType(f.type));
                const enumValues = isEnum ? registry.enums[String(f.type)] ?? [] : [];

                return (
                  <div key={f.name} className={cn("rounded-md border border-neutral-200 p-3", err && "border-red-300")}>
                    {baseLabel}
                    {isPkReadOnly ? (
                      <Input value={String(val ?? "")} disabled />
                    ) : f.kind === "scalar" && f.type === "Boolean" && !f.isList ? (
                      <label className="flex items-center gap-2">
                        <Checkbox checked={!!val} onCheckedChange={(v) => setValue(v)} aria-label={f.name} />
                        <span className="text-sm text-neutral-800">{!!val ? "true" : "false"}</span>
                      </label>
                    ) : f.kind === "scalar" && f.type === "DateTime" && !f.isList ? (
                      <Input type="datetime-local" value={String(val ?? "")} onChange={(e) => setValue(e.target.value)} />
                    ) : isEnum ? (
                      <Select
                        value={String(val ?? "")}
                        onChange={(v) => setValue(v)}
                        options={enumValues.map((x) => ({ value: x, label: x }))}
                        placeholder="Select…"
                      />
                    ) : f.kind === "scalar" && f.type === "Json" ? (
                      <Textarea value={String(val ?? "")} onChange={(e) => setValue(e.target.value)} placeholder='{"key":"value"}' />
                    ) : f.isList && f.type === "String" ? (
                      <Input value={String(val ?? "")} onChange={(e) => setValue(e.target.value)} placeholder="tag1, tag2" />
                    ) : f.kind === "scalar" && (f.type === "Int" || f.type === "Float") ? (
                      <Input type="number" value={String(val ?? "")} onChange={(e) => setValue(e.target.value)} />
                    ) : shouldUseTextarea(f) ? (
                      <Textarea value={String(val ?? "")} onChange={(e) => setValue(e.target.value)} />
                    ) : (
                      <Input value={String(val ?? "")} onChange={(e) => setValue(e.target.value)} />
                    )}
                    {err ? <div className="mt-1 text-xs text-red-700">{err}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!deleteRow}
        onOpenChange={(v) => (v ? null : setDeleteRow(null))}
        title="Confirm Delete"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteRow(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteOne}>
              Delete
            </Button>
          </div>
        }
      >
        <div className="text-sm text-neutral-800">
          Delete this record? This action cannot be undone.
          {model ? (
            <div className="mt-2 text-xs text-neutral-500">
              {model.name} • {model.primaryKey}: {formatCellValue(deleteRow?.[model.primaryKey])}
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Confirm Bulk Delete"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmBulkDelete} disabled={!selectedCount}>
              Delete ({selectedCount})
            </Button>
          </div>
        }
      >
        <div className="text-sm text-neutral-800">
          Delete {selectedCount} selected records? This action cannot be undone.
          {selectedCount ? <div className="mt-2 text-xs text-neutral-500">IDs: {Array.from(selectedIds).slice(0, 8).join(", ")}{selectedCount > 8 ? "…" : ""}</div> : null}
        </div>
      </Dialog>

      <Dialog
        open={savedViewsOpen}
        onOpenChange={setSavedViewsOpen}
        title="Saved Views"
        widthClass="max-w-3xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSavedViewsOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <div className="text-xs font-semibold text-neutral-700">Save current view</div>
            <div className="mt-2 flex gap-2">
              <Input value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="Name…" />
              <Button
                onClick={() => {
                  const name = newViewName.trim();
                  if (!name) return;
                  createSavedView(name);
                  setNewViewName("");
                }}
                disabled={!newViewName.trim() || !applied}
              >
                Save
              </Button>
            </div>
          </div>

          <div className="text-xs text-neutral-600">Saved views are persisted in localStorage.</div>

          {savedViews.length ? (
            <div className="overflow-auto rounded-md border border-neutral-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-neutral-50">
                  <tr className="border-b border-neutral-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-700">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedViews.map((v) => (
                    <tr key={v.id} className="border-b border-neutral-100">
                      <td className="px-3 py-2">{v.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-700">
                          <Badge variant="outline">{v.model}</Badge>
                          <span className="text-neutral-500">Cols:</span>
                          <span className="max-w-[520px] truncate" title={(v.params.visibleColumns ?? []).join(", ")}>
                            {(v.params.visibleColumns ?? []).join(", ") || "—"}
                          </span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-500">Filters:</span>
                          <span>{(v.params.filters ?? []).length}</span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-500">Sort:</span>
                          <span>{v.params.sort ? `${v.params.sort.field} ${v.params.sort.dir}` : "—"}</span>
                          <span className="text-neutral-500">•</span>
                          <span className="text-neutral-500">Size:</span>
                          <span>{v.params.pageSize ?? 20}</span>
                          {v.params.searchText ? (
                            <>
                              <span className="text-neutral-500">•</span>
                              <span className="text-neutral-500">Search:</span>
                              <span className="max-w-[240px] truncate" title={v.params.searchText}>
                                {v.params.searchText}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => applySavedView(v)}>
                            Apply
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteSavedView(v.id)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-neutral-200 p-3 text-sm text-neutral-600">No saved views.</div>
          )}
        </div>
      </Dialog>

      <Dialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Export"
        widthClass="max-w-xl"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div className="text-sm text-neutral-800">Export current rows ({rows.length}).</div>
          <div className="text-xs text-neutral-600">Uses currently visible columns.</div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!applied) return;
                const json = JSON.stringify(rows, null, 2);
                downloadBlob(`${applied.model}.json`, "application/json;charset=utf-8", json);
                push({ type: "success", title: "JSON دانلود شد" });
              }}
              disabled={!rows.length || !applied}
            >
              Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!applied) return;
                const csv = toCsv(rows, columns);
                downloadBlob(`${applied.model}.csv`, "text/csv;charset=utf-8", csv);
                push({ type: "success", title: "CSV دانلود شد" });
              }}
              disabled={!rows.length || !applied}
            >
              Export CSV
            </Button>
          </div>
          {applied ? (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
              <div className="font-semibold">Preview</div>
              <div className="mt-1">Columns: {columns.join(", ") || "—"}</div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(v) => {
          setImportOpen(v);
          if (!v) {
            setImportText("");
            setImportObjects([]);
            setImportKeys([]);
            setImportSelectedKeys(new Set());
            setImportError(null);
            setImporting(false);
          }
        }}
        title="Import (JSON)"
        widthClass="max-w-3xl"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-neutral-500">
              {model ? (
                <>
                  Model: <span className="font-semibold text-neutral-800">{model.name}</span> • PK:{" "}
                  <span className="font-semibold text-neutral-800">{model.primaryKey}</span>
                </>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={runImport} disabled={!canRender || importing || (!!importError && !!importText.trim())}>
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        }
      >
        {!model ? (
          <div className="text-sm text-neutral-700">ابتدا یک مدل انتخاب کنید.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <div className="text-xs text-neutral-600">
              JSON را paste کنید (یک object یا آرایه‌ای از object). اگر `id` (Primary Key) موجود باشد یا با فیلدهای unique پیدا شود → update؛
              در غیر این صورت → create.
            </div>

            {importKeys.length ? (
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-neutral-700">Fields to update (for updates)</div>
                  <div className="text-xs text-neutral-500">
                    {importObjects.length} rows • selected: {importSelectedKeys.size}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  {importKeys
                    .filter((k) => k !== model.primaryKey)
                    .map((k) => {
                      const checked = importSelectedKeys.has(k);
                      return (
                        <label key={k} className="flex cursor-pointer items-center gap-2 rounded border border-neutral-200 bg-white px-2 py-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setImportSelectedKeys((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(k);
                                else next.delete(k);
                                return next;
                              });
                            }}
                            aria-label={`Update field ${k}`}
                          />
                          <span className="truncate text-xs text-neutral-800" title={k}>
                            {k}
                          </span>
                        </label>
                      );
                    })}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setImportSelectedKeys(new Set(importKeys.filter((k) => k !== model.primaryKey)))}
                  >
                    Select all
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setImportSelectedKeys(new Set())}>
                    Clear
                  </Button>
                </div>
                <div className="mt-2 text-[11px] text-neutral-500">
                  نکته: برای create همه‌ی فیلدهای موجود در JSON ارسال می‌شود؛ این انتخاب فقط روی update اثر دارد.
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-neutral-200 p-3">
              <div className="mb-1 text-xs font-semibold text-neutral-700">Paste JSON</div>
              <Textarea
                value={importText}
                onChange={(e) => {
                  const t = e.target.value;
                  setImportText(t);
                  parseImportJson(t);
                }}
                placeholder='[{"id":1,"name":"..."}, {"name":"new"}]'
                className="min-h-[220px] font-mono text-xs"
              />
              {importError ? <div className="mt-2 text-sm text-red-700">{importError}</div> : null}
              {!importError && importObjects.length ? (
                <div className="mt-2 text-xs text-neutral-600">
                  Parsed: <span className="font-semibold text-neutral-900">{importObjects.length}</span> rows • Keys:{" "}
                  <span className="font-semibold text-neutral-900">{importKeys.length}</span>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Dialog>

      <ToastViewport toasts={toasts} />
    </div>
  );
}
