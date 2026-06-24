"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { MenuIcon } from "@/components/icons";
import type { EditableMenus, Menu, MenuIcon as MenuIconName, MenuItem } from "@/menus/types";

type ApiResponse = {
  ok: boolean;
  menus?: EditableMenus;
  error?: string;
};

type MenuKey = keyof EditableMenus;
type Path = number[];
type PendingMove = {
  fromPath: Path;
  toPath: Path;
  fromTop: number;
  toTop: number;
};

const emptyMenus: EditableMenus = {
  site: { id: "marketing", primary: [] },
  dashboard: { id: "dashboard", primary: [] },
};

function createLink(): MenuItem {
  return { type: "link", label: "New link", href: "/", icon: "link" };
}

function createGroup(): MenuItem {
  return { type: "group", label: "New menu", icon: "app", items: [] };
}

function pathKey(path: Path) {
  return path.join(".");
}

function samePath(a: Path | null, b: Path) {
  if (!a) return false;
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

function getAtPath(items: MenuItem[], path: Path): MenuItem | null {
  const [index, ...rest] = path;
  const item = index == null ? null : items[index] ?? null;
  if (!item) return null;
  if (rest.length === 0) return item;
  return item.type === "group" ? getAtPath(item.items, rest) : null;
}

function getListAtPath(items: MenuItem[], path: Path): MenuItem[] | null {
  if (path.length === 0) return items;
  const parent = getAtPath(items, path);
  return parent?.type === "group" ? parent.items : null;
}

function updateAtPath(items: MenuItem[], path: Path, updater: (item: MenuItem) => MenuItem): MenuItem[] {
  const [index, ...rest] = path;
  if (index == null) return items;
  return items.map((item, i) => {
    if (i !== index) return item;
    if (rest.length === 0) return updater(item);
    if (item.type !== "group") return item;
    return { ...item, items: updateAtPath(item.items, rest, updater) };
  });
}

function updateListAtPath(
  items: MenuItem[],
  path: Path,
  updater: (items: MenuItem[]) => MenuItem[],
): MenuItem[] {
  if (path.length === 0) return updater(items);
  const [index, ...rest] = path;
  return items.map((item, i) => {
    if (i !== index || item.type !== "group") return item;
    return { ...item, items: updateListAtPath(item.items, rest, updater) };
  });
}

function moveItem(items: MenuItem[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (!item) return items;
  next.splice(toIndex, 0, item);
  return next;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="grid gap-1 text-xs font-medium opacity-80">{children}</label>;
}

function itemSummary(item: MenuItem) {
  if (item.type === "link") return item.href;
  return `${item.items.length} item${item.items.length === 1 ? "" : "s"}`;
}

function MenuItemCard({
  item,
  path,
  depth,
  editingPath,
  onEdit,
  onAddChild,
  onDelete,
  onMove,
}: {
  item: MenuItem;
  path: Path;
  depth: number;
  editingPath: Path | null;
  onEdit: (path: Path) => void;
  onAddChild: (path: Path, item: MenuItem) => void;
  onDelete: (path: Path) => void;
  onMove: (path: Path, direction: -1 | 1) => void;
}) {
  const [reorderHintState, setReorderHintState] = useState<"hidden" | "visible" | "fading">("hidden");
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const reorderHintActiveRef = useRef(false);
  const reorderHintTimerRef = useRef<number | null>(null);

  function clearReorderHintTimer() {
    if (reorderHintTimerRef.current !== null) {
      window.clearTimeout(reorderHintTimerRef.current);
      reorderHintTimerRef.current = null;
    }
  }

  function finishPointerInteraction() {
    pointerStartRef.current = null;
    if (!reorderHintActiveRef.current) return;

    reorderHintActiveRef.current = false;
    setReorderHintState("fading");
    clearReorderHintTimer();
    reorderHintTimerRef.current = window.setTimeout(() => setReorderHintState("hidden"), 1_000);
  }

  return (
    <div
      data-menu-path={pathKey(path)}
      className={`relative select-none rounded border bg-white/70 p-3 shadow-sm transition hover:bg-white dark:bg-black/10 dark:hover:bg-white/10 ${
        samePath(editingPath, path) ? "ring-2 ring-black dark:ring-white" : ""
      } ${reorderHintState === "visible" ? "cursor-grabbing" : "cursor-default"}`}
      onPointerDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        clearReorderHintTimer();
        reorderHintActiveRef.current = false;
        setReorderHintState("hidden");
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        const pointerStart = pointerStartRef.current;
        if (!pointerStart || reorderHintActiveRef.current) return;
        const movedEnough = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) >= 6;
        if (!movedEnough) return;

        reorderHintActiveRef.current = true;
        setReorderHintState("visible");
      }}
      onPointerUp={finishPointerInteraction}
      onPointerCancel={finishPointerInteraction}
    >
      {reorderHintState !== "hidden" ? (
        <span
          className={`pointer-events-none absolute inset-0 z-10 grid place-items-center rounded bg-red-50/90 text-lg font-bold text-red-600 backdrop-blur-[1px] transition-opacity duration-1000 dark:bg-red-950/80 dark:text-red-300 ${
            reorderHintState === "fading" ? "opacity-0" : "opacity-100"
          }`}
        >
          Use ↑ and ↓ buttons to reorder
        </span>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {item.icon ? <MenuIcon name={item.icon} className="size-4 opacity-75" /> : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold">{item.label || "Untitled"}</div>
              {item.type === "group" ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddChild(path, createLink());
                  }}
                  className="shrink-0 rounded border px-2 py-1 text-xs"
                >
                  Add
                </button>
              ) : null}
            </div>
            <div className="truncate text-xs opacity-65">
              {item.type} - level {depth} - {itemSummary(item)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => onEdit(path)} className="rounded border px-2 py-1 text-xs">
            Edit
          </button>
          <button type="button" onClick={() => onMove(path, -1)} className="rounded border px-2 py-1 text-xs">
            ↑ Up
          </button>
          <button type="button" onClick={() => onMove(path, 1)} className="rounded border px-2 py-1 text-xs">
            ↓ Down
          </button>
          <button
            type="button"
            onClick={() => onDelete(path)}
            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {item.type === "group" ? (
        <div className="mt-3 grid gap-2 border-l pl-3" onClick={(event) => event.stopPropagation()}>
          {item.items.map((child, index) => (
            <MenuItemCard
              key={`${pathKey(path)}.${index}`}
              item={child}
              path={[...path, index]}
              depth={depth + 1}
              editingPath={editingPath}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IconPicker({
  value,
  iconNames,
  onChange,
}: {
  value?: MenuIconName;
  iconNames: MenuIconName[];
  onChange: (icon: MenuIconName | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm"
      >
        <span className="flex items-center gap-2">
          {value ? <MenuIcon name={value} className="size-4" /> : <span className="size-4" />}
          <span>{value ?? "No icon"}</span>
        </span>
        <span aria-hidden>⌄</span>
      </button>

      {open ? (
        <div className="mt-2 grid max-h-[46vh] gap-1 overflow-auto rounded border bg-white p-2 shadow-lg sm:grid-cols-2 dark:bg-neutral-950">
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <span className="size-4" />
            No icon
          </button>
          {iconNames.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                value === icon ? "bg-black text-white dark:bg-white dark:text-black" : ""
              }`}
            >
              <MenuIcon name={icon} className="size-4" />
              {icon}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EditItemModal({
  item,
  path,
  depth,
  iconNames,
  onClose,
  onChange,
  onOpenHrefPicker,
}: {
  item: MenuItem;
  path: Path;
  depth: number;
  iconNames: MenuIconName[];
  onClose: () => void;
  onChange: (path: Path, item: MenuItem) => void;
  onOpenHrefPicker: (path: Path) => void;
}) {
  const canBeGroup = depth < 3;

  function setType(type: MenuItem["type"]) {
    if (type === item.type) return;
    if (type === "link") {
      onChange(path, {
        type: "link",
        label: item.label,
        href: "/",
        icon: item.icon,
      });
    } else {
      onChange(path, {
        type: "group",
        label: item.label,
        icon: item.icon,
        items: [],
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div
        className="grid max-h-[94vh] w-full max-w-4xl gap-4 overflow-auto rounded border bg-white p-5 shadow-xl dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Edit menu item</h2>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FieldLabel>
            Label
            <input
              value={item.label}
              onChange={(event) => onChange(path, { ...item, label: event.target.value })}
              className="rounded border px-2 py-1.5 text-sm"
            />
          </FieldLabel>

          <FieldLabel>
            Type
            <select
              value={item.type}
              onChange={(event) => setType(event.target.value as MenuItem["type"])}
              className="rounded border px-2 py-1.5 text-sm"
            >
              <option value="link">Link</option>
              <option value="group" disabled={!canBeGroup}>
                Menu group
              </option>
            </select>
          </FieldLabel>

          <FieldLabel>
            Icon
            <IconPicker
              value={item.icon}
              iconNames={iconNames}
              onChange={(icon) => onChange(path, { ...item, icon })}
            />
          </FieldLabel>

          {item.type === "link" ? (
            <FieldLabel>
              Href
              <button
                type="button"
                onClick={() => onOpenHrefPicker(path)}
                className="truncate rounded border px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                {item.href || "Choose href"}
              </button>
            </FieldLabel>
          ) : null}
        </div>

        {item.type === "link" ? (
          <FieldLabel>
            Description
            <input
              value={item.description ?? ""}
              onChange={(event) =>
                onChange(path, {
                  ...item,
                  description: event.target.value || undefined,
                })
              }
              className="rounded border px-2 py-1.5 text-sm"
            />
          </FieldLabel>
        ) : null}
      </div>
    </div>
  );
}

function HrefPickerModal({
  currentHref,
  routes,
  onChoose,
  onClose,
}: {
  currentHref: string;
  routes: string[];
  onChoose: (href: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [externalHref, setExternalHref] = useState(currentHref.startsWith("http") ? currentHref : "");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRoutes = normalizedQuery
    ? routes.filter((route) => route.toLowerCase().includes(normalizedQuery))
    : routes;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
      <div
        className="grid max-h-[94vh] w-full max-w-4xl gap-4 overflow-hidden rounded border bg-white p-5 shadow-xl dark:bg-neutral-950"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Choose href</h2>
          <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm">
            Close
          </button>
        </div>

        <div className="grid gap-2">
          <FieldLabel>
            External URL
            <div className="flex gap-2">
              <input
                value={externalHref}
                onChange={(event) => setExternalHref(event.target.value)}
                placeholder="https://example.com"
                className="min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  onChoose(externalHref);
                  onClose();
                }}
                disabled={!externalHref.trim()}
                className="rounded border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </FieldLabel>
        </div>

        <div className="grid min-h-0 gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search internal pages..."
            className="rounded border px-3 py-2 text-sm"
          />
          <div className="grid max-h-[58vh] gap-1 overflow-auto rounded border p-2">
            {filteredRoutes.map((route) => (
              <button
                key={route}
                type="button"
                onClick={() => {
                  onChoose(route);
                  onClose();
                }}
                className={`rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-black/5 dark:hover:bg-white/10 ${
                  currentHref === route ? "bg-black text-white dark:bg-white dark:text-black" : ""
                }`}
              >
                {route}
              </button>
            ))}
            {filteredRoutes.length === 0 ? <div className="p-4 text-center text-sm opacity-60">No page found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MenuManagerClient({
  initialMenus,
  iconNames,
  siteRoutes,
}: {
  initialMenus: EditableMenus;
  iconNames: MenuIconName[];
  siteRoutes: string[];
}) {
  const [menus, setMenus] = useState<EditableMenus>(initialMenus ?? emptyMenus);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("site");
  const [status, setStatus] = useState("Loaded.");
  const [saving, setSaving] = useState(false);
  const [editingPath, setEditingPath] = useState<Path | null>(null);
  const [hrefPickerPath, setHrefPickerPath] = useState<Path | null>(null);
  const pendingMoveRef = useRef<PendingMove | null>(null);
  const lastSavedMenusRef = useRef(JSON.stringify(initialMenus ?? emptyMenus));
  const pendingSaveRef = useRef<EditableMenus | null>(null);
  const saveInProgressRef = useRef(false);
  const flushAutoSaveRef = useRef<() => Promise<void>>(async () => {});

  useLayoutEffect(() => {
    const pendingMove = pendingMoveRef.current;
    if (!pendingMove) return;
    pendingMoveRef.current = null;

    const fromElement = document.querySelector<HTMLElement>(`[data-menu-path="${pathKey(pendingMove.fromPath)}"]`);
    const toElement = document.querySelector<HTMLElement>(`[data-menu-path="${pathKey(pendingMove.toPath)}"]`);
    if (!fromElement || !toElement) return;

    function animateFromPreviousPosition(element: HTMLElement, offset: number) {
      element.style.transition = "none";
      element.style.transform = `translateY(${offset}px)`;
      void element.offsetHeight;
      requestAnimationFrame(() => {
        element.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
        element.style.transform = "";
        window.setTimeout(() => {
          element.style.transition = "";
        }, 220);
      });
    }

    animateFromPreviousPosition(fromElement, pendingMove.toTop - pendingMove.fromTop);
    animateFromPreviousPosition(toElement, pendingMove.fromTop - pendingMove.toTop);
  }, [menus]);

  async function loadMenus() {
    setStatus("Loading menu config...");
    const res = await fetch("/api/admin/menu-manager", { cache: "no-store" });
    const data = (await res.json()) as ApiResponse;
    if (!data.ok || !data.menus) {
      setStatus(data.error ?? "Failed to load menus.");
      return;
    }
    lastSavedMenusRef.current = JSON.stringify(data.menus);
    pendingSaveRef.current = null;
    setMenus(data.menus);
    setEditingPath(null);
    setHrefPickerPath(null);
    setStatus("Loaded.");
  }

  const flushAutoSave = useCallback(async () => {
    if (saveInProgressRef.current) return;
    const menusToSave = pendingSaveRef.current;
    if (!menusToSave) return;

    pendingSaveRef.current = null;
    saveInProgressRef.current = true;
    let retryScheduled = false;
    setSaving(true);
    setStatus("Saving...");
    try {
      const res = await fetch("/api/admin/menu-manager", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ menus: menusToSave }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok || !data.menus) {
        pendingSaveRef.current ??= menusToSave;
        setStatus(data.error ?? "Save failed. Retrying...");
        retryScheduled = true;
        window.setTimeout(() => void flushAutoSaveRef.current(), 2_000);
        return;
      }
      lastSavedMenusRef.current = JSON.stringify(data.menus);
      setStatus(pendingSaveRef.current ? "Saving..." : "Saved.");
    } catch {
      pendingSaveRef.current ??= menusToSave;
      setStatus("Save failed. Retrying...");
      retryScheduled = true;
      window.setTimeout(() => void flushAutoSaveRef.current(), 2_000);
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);
      if (pendingSaveRef.current && !retryScheduled) void flushAutoSaveRef.current();
    }
  }, []);

  flushAutoSaveRef.current = flushAutoSave;

  useEffect(() => {
    if (JSON.stringify(menus) === lastSavedMenusRef.current) return;

    setStatus("Changes pending...");
    const timeout = window.setTimeout(() => {
      pendingSaveRef.current = menus;
      void flushAutoSave();
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [menus, flushAutoSave]);

  function updateActiveMenu(updater: (menu: Menu) => Menu) {
    setMenus((current) => ({
      ...current,
      [activeMenu]: updater(current[activeMenu]),
    }));
  }

  function handleChange(path: Path, item: MenuItem) {
    updateActiveMenu((menu) => ({
      ...menu,
      primary: updateAtPath(menu.primary, path, () => item),
    }));
  }

  function handleAddRoot(item: MenuItem) {
    const nextPath = [menus[activeMenu].primary.length];
    updateActiveMenu((menu) => ({ ...menu, primary: [...menu.primary, item] }));
    setEditingPath(nextPath);
  }

  function handleAddChild(path: Path, item: MenuItem) {
    const parent = getAtPath(menus[activeMenu].primary, path);
    if (parent?.type !== "group") return;
    const nextPath = [...path, parent.items.length];
    updateActiveMenu((menu) => ({
      ...menu,
      primary: updateAtPath(menu.primary, path, (target) => {
        if (target.type !== "group") return target;
        return { ...target, items: [...target.items, item] };
      }),
    }));
    setEditingPath(nextPath);
  }

  function handleDelete(path: Path) {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    updateActiveMenu((menu) => ({
      ...menu,
      primary: updateListAtPath(menu.primary, parentPath, (items) => items.filter((_, i) => i !== index)),
    }));
    if (samePath(editingPath, path)) setEditingPath(null);
    if (samePath(hrefPickerPath, path)) setHrefPickerPath(null);
  }

  function handleMove(path: Path, direction: -1 | 1) {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1] ?? 0;
    const nextIndex = index + direction;
    const siblings = getListAtPath(menus[activeMenu].primary, parentPath);
    if (!siblings || nextIndex < 0 || nextIndex >= siblings.length) return;

    const targetPath = [...parentPath, nextIndex];
    const fromElement = document.querySelector<HTMLElement>(`[data-menu-path="${pathKey(path)}"]`);
    const toElement = document.querySelector<HTMLElement>(`[data-menu-path="${pathKey(targetPath)}"]`);
    if (fromElement && toElement) {
      pendingMoveRef.current = {
        fromPath: path,
        toPath: targetPath,
        fromTop: fromElement.getBoundingClientRect().top,
        toTop: toElement.getBoundingClientRect().top,
      };
    }

    updateActiveMenu((menu) => ({
      ...menu,
      primary: updateListAtPath(menu.primary, parentPath, (items) => moveItem(items, index, nextIndex)),
    }));
    if (samePath(editingPath, path) && nextIndex >= 0) setEditingPath([...parentPath, nextIndex]);
  }

  function chooseHref(path: Path, href: string) {
    handleChange(path, getAtPath(menus[activeMenu].primary, path)?.type === "link"
      ? { ...(getAtPath(menus[activeMenu].primary, path) as Extract<MenuItem, { type: "link" }>), href }
      : createLink());
  }

  function switchMenu(key: MenuKey) {
    setActiveMenu(key);
    setEditingPath(null);
    setHrefPickerPath(null);
  }

  const active = menus[activeMenu];
  const editingItem = editingPath ? getAtPath(active.primary, editingPath) : null;
  const hrefPickerItem = hrefPickerPath ? getAtPath(active.primary, hrefPickerPath) : null;
  const statusTone = saving
    ? "bg-sky-500"
    : status.includes("failed")
      ? "bg-red-500"
      : status === "Saved." || status === "Loaded."
        ? "bg-emerald-500"
        : "bg-amber-500";
  const totalItems = useMemo(() => {
    function count(items: MenuItem[]): number {
      return items.reduce((sum, item) => sum + 1 + (item.type === "group" ? count(item.items) : 0), 0);
    }
    return count(active.primary);
  }, [active.primary]);

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 p-4">
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border bg-white/95 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur dark:bg-neutral-950/95"
      >
        <span className={`size-2.5 rounded-full ${statusTone} ${saving ? "animate-pulse" : ""}`} aria-hidden />
        {saving ? "Saving..." : status}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Menu Manager</h1>
          <p className="mt-1 text-sm opacity-75">
            Edit site and admin menus from the JSON config without touching the file directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadMenus()} className="rounded border px-3 py-2 text-sm">
            Reload
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white/60 p-3 dark:bg-black/10">
        <div className="flex gap-2">
          {(["site", "dashboard"] as MenuKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMenu(key)}
              className={`rounded border px-3 py-1.5 text-sm ${
                activeMenu === key ? "bg-black text-white dark:bg-white dark:text-black" : ""
              }`}
            >
              {key === "site" ? "Site menu" : "Admin menu"}
            </button>
          ))}
        </div>
        <div className="text-xs opacity-70">
          {active.id} - {totalItems} items - max 3 levels
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => handleAddRoot(createLink())} className="rounded border px-3 py-2 text-sm">
          Create link
        </button>
        <button type="button" onClick={() => handleAddRoot(createGroup())} className="rounded border px-3 py-2 text-sm">
          Create menu
        </button>
      </div>

      <div className="grid gap-3">
        {active.primary.map((item, index) => (
          <MenuItemCard
            key={index}
            item={item}
            path={[index]}
            depth={1}
            editingPath={editingPath}
            onEdit={setEditingPath}
            onAddChild={handleAddChild}
            onDelete={handleDelete}
            onMove={handleMove}
          />
        ))}
        {active.primary.length === 0 ? (
          <div className="rounded border border-dashed p-8 text-center text-sm opacity-70">No menu items yet.</div>
        ) : null}
      </div>

      <div className="rounded border bg-white/60 p-3 text-sm dark:bg-black/10">{status}</div>

      {editingPath && editingItem ? (
        <EditItemModal
          item={editingItem}
          path={editingPath}
          depth={editingPath.length}
          iconNames={iconNames}
          onClose={() => setEditingPath(null)}
          onChange={handleChange}
          onOpenHrefPicker={setHrefPickerPath}
        />
      ) : null}

      {hrefPickerPath && hrefPickerItem?.type === "link" ? (
        <HrefPickerModal
          currentHref={hrefPickerItem.href}
          routes={siteRoutes}
          onChoose={(href) => chooseHref(hrefPickerPath, href)}
          onClose={() => setHrefPickerPath(null)}
        />
      ) : null}
    </main>
  );
}
