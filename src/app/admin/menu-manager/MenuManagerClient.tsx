"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { ActionIcon, MenuIcon } from "@/components/icons";
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

function countMenuItems(items: MenuItem[]) {
  return items.reduce(
    (stats, item) => {
      stats.total += 1;
      stats[item.type === "group" ? "groups" : "links"] += 1;
      if (item.type === "group") {
        const childStats = countMenuItems(item.items);
        stats.total += childStats.total;
        stats.links += childStats.links;
        stats.groups += childStats.groups;
      }
      return stats;
    },
    { total: 0, links: 0, groups: 0 },
  );
}

function collectGroupPaths(items: MenuItem[], parentPath: Path = []): string[] {
  return items.flatMap((item, index) => {
    const path = [...parentPath, index];
    return item.type === "group" ? [pathKey(path), ...collectGroupPaths(item.items, path)] : [];
  });
}

function itemContainsQuery(item: MenuItem, query: string): boolean {
  if (!query) return true;
  const ownText = `${item.label} ${item.type === "link" ? item.href : ""}`.toLowerCase();
  return ownText.includes(query) || (item.type === "group" && item.items.some((child) => itemContainsQuery(child, query)));
}

function getBreadcrumbs(items: MenuItem[], path: Path) {
  const labels: string[] = [];
  let currentItems = items;
  for (const index of path) {
    const item = currentItems[index];
    if (!item) break;
    labels.push(item.label || "Untitled");
    currentItems = item.type === "group" ? item.items : [];
  }
  return labels;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="grid gap-2 text-[13px] font-semibold text-neutral-700 dark:text-neutral-200">{children}</label>;
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
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm transition hover:border-black/20 dark:border-white/15 dark:bg-white/5"
      >
        <span className="flex items-center gap-2">
          {value ? <MenuIcon name={value} className="size-4" /> : <span className="size-4" />}
          <span>{value ?? "No icon"}</span>
        </span>
        <span aria-hidden className={`text-xs opacity-50 transition ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 grid max-h-72 gap-1 overflow-auto rounded-xl border border-black/10 bg-white p-2 shadow-2xl sm:grid-cols-2 dark:border-white/15 dark:bg-neutral-950">
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
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
              className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                value === icon
                  ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
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

function MenuTreeItem({
  item,
  path,
  depth,
  siblingCount,
  selectedPath,
  collapsedPaths,
  query,
  onSelect,
  onToggle,
  onAddChild,
  onMove,
}: {
  item: MenuItem;
  path: Path;
  depth: number;
  siblingCount: number;
  selectedPath: Path | null;
  collapsedPaths: Set<string>;
  query: string;
  onSelect: (path: Path) => void;
  onToggle: (path: Path) => void;
  onAddChild: (path: Path, item: MenuItem) => void;
  onMove: (path: Path, direction: -1 | 1) => void;
}) {
  if (!itemContainsQuery(item, query)) return null;

  const key = pathKey(path);
  const selected = samePath(selectedPath, path);
  const collapsed = collapsedPaths.has(key) && !query;
  const index = path[path.length - 1] ?? 0;

  return (
    <div data-menu-path={key}>
      <div
        className={`group/tree-row flex min-h-14 items-center gap-1 border-b border-black/[0.055] pr-2 transition last:border-b-0 dark:border-white/[0.07] ${
          selected
            ? "bg-blue-50/90 text-blue-950 shadow-[inset_3px_0_0_#2563eb] dark:bg-blue-500/15 dark:text-blue-50"
            : "hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
        }`}
        style={{ paddingLeft: `${8 + depth * 18}px` }}
      >
        {item.type === "group" ? (
          <button
            type="button"
            onClick={() => onToggle(path)}
            aria-label={collapsed ? `Expand ${item.label}` : `Collapse ${item.label}`}
            aria-expanded={!collapsed}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-xs opacity-55 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          >
            <span className={`transition ${collapsed ? "-rotate-90" : ""}`} aria-hidden>
              ▼
            </span>
          </button>
        ) : (
          <span className="size-8 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => onSelect(path)}
          className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
        >
          <span
            className={`grid size-9 shrink-0 place-items-center rounded-xl ${
              item.type === "group"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
            }`}
          >
            {item.icon ? (
              <MenuIcon name={item.icon} className="size-[18px]" />
            ) : (
              <span className="text-xs font-bold">{item.type === "group" ? "M" : "L"}</span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">{item.label || "Untitled"}</span>
              {item.type === "group" ? (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold opacity-65 dark:bg-white/10">
                  {item.items.length}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-xs opacity-55">
              {item.type === "link" ? item.href : `Menu group · Level ${depth + 1}`}
            </span>
          </span>
        </button>

        <div
          className={`flex shrink-0 items-center gap-0.5 transition ${
            selected ? "opacity-100" : "opacity-30 group-hover/tree-row:opacity-100"
          }`}
        >
          {item.type === "group" && depth < 2 ? (
            <button
              type="button"
              onClick={() => onAddChild(path, createLink())}
              aria-label={`Add link to ${item.label}`}
              title="Add child link"
              className="grid size-8 place-items-center rounded-lg text-lg transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              +
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onMove(path, -1)}
            disabled={index === 0}
            aria-label={`Move ${item.label} up`}
            title="Move up"
            className="grid size-8 place-items-center rounded-lg text-sm transition hover:bg-black/5 disabled:opacity-20 dark:hover:bg-white/10"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(path, 1)}
            disabled={index === siblingCount - 1}
            aria-label={`Move ${item.label} down`}
            title="Move down"
            className="grid size-8 place-items-center rounded-lg text-sm transition hover:bg-black/5 disabled:opacity-20 dark:hover:bg-white/10"
          >
            ↓
          </button>
        </div>
      </div>

      {item.type === "group" && !collapsed ? (
        <div className="relative">
          <span
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-black/10 dark:bg-white/10"
            style={{ left: `${25 + depth * 18}px` }}
            aria-hidden
          />
          {item.items.map((child, childIndex) => (
            <MenuTreeItem
              key={`${key}.${childIndex}`}
              item={child}
              path={[...path, childIndex]}
              depth={depth + 1}
              siblingCount={item.items.length}
              selectedPath={selectedPath}
              collapsedPaths={collapsedPaths}
              query={query}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onMove={onMove}
            />
          ))}
          {item.items.length === 0 ? (
            <button
              type="button"
              onClick={() => onAddChild(path, createLink())}
              className="flex w-full items-center gap-2 border-b border-black/[0.055] py-3 pr-3 text-left text-xs font-medium text-blue-600 hover:bg-blue-50/60 dark:border-white/[0.07] dark:text-blue-300 dark:hover:bg-blue-500/10"
              style={{ paddingLeft: `${62 + depth * 18}px` }}
            >
              <span aria-hidden>＋</span> Add the first link
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ItemInspector({
  item,
  path,
  breadcrumbs,
  iconNames,
  onChange,
  onAddChild,
  onDelete,
  onOpenHrefPicker,
}: {
  item: MenuItem | null;
  path: Path | null;
  breadcrumbs: string[];
  iconNames: MenuIconName[];
  onChange: (path: Path, item: MenuItem) => void;
  onAddChild: (path: Path, item: MenuItem) => void;
  onDelete: (path: Path) => void;
  onOpenHrefPicker: (path: Path) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!item || !path) {
    return (
      <div className="grid min-h-96 place-items-center p-8 text-center">
        <div className="max-w-xs">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
            <MenuIcon name="settings" className="size-6" />
          </div>
          <h2 className="mt-4 font-semibold">Select a menu item</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Choose an item from the structure to edit its label, destination, icon, or children.
          </p>
        </div>
      </div>
    );
  }

  const activeItem = item;
  const activePath = path;
  const canBecomeGroup = path.length < 3;

  function setType(type: MenuItem["type"]) {
    if (type === activeItem.type) return;
    if (type === "link") {
      onChange(activePath, { type: "link", label: activeItem.label, href: "/", icon: activeItem.icon });
      return;
    }
    onChange(activePath, { type: "group", label: activeItem.label, icon: activeItem.icon, items: [] });
  }

  return (
    <div>
      <div className="border-b border-black/10 p-5 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-muted">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1">
                  {index > 0 ? <span className="opacity-40">/</span> : null}
                  <span className="max-w-28 truncate">{crumb}</span>
                </span>
              ))}
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold">{item.label || "Untitled"}</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              item.type === "group"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300"
                : "bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300"
            }`}
          >
            {item.type === "group" ? "Menu group" : "Link"}
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-5">
        <FieldLabel>
          Label
          <input
            value={item.label}
            onChange={(event) => onChange(path, { ...item, label: event.target.value })}
            placeholder="Navigation label"
            className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/15 dark:bg-white/5"
          />
        </FieldLabel>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <FieldLabel>
            Item type
            <select
              value={item.type}
              onChange={(event) => setType(event.target.value as MenuItem["type"])}
              className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/15 dark:bg-neutral-900"
            >
              <option value="link" disabled={item.type === "group" && item.items.length > 0}>
                Link
              </option>
              <option value="group" disabled={!canBecomeGroup}>
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
        </div>

        {item.type === "link" ? (
          <>
            <FieldLabel>
              Destination
              <button
                type="button"
                onClick={() => onOpenHrefPicker(path)}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50/40 dark:border-white/15 dark:bg-white/5 dark:hover:bg-blue-500/10"
              >
                <span className="min-w-0 truncate font-mono text-xs">{item.href || "Choose a destination"}</span>
                <span className="shrink-0 text-blue-600 dark:text-blue-300">Choose</span>
              </button>
            </FieldLabel>

            <FieldLabel>
              Description <span className="-mt-7 ml-auto text-[11px] font-normal text-muted">Optional</span>
              <textarea
                value={item.description ?? ""}
                onChange={(event) =>
                  onChange(path, {
                    ...item,
                    description: event.target.value || undefined,
                  })
                }
                rows={3}
                placeholder="Add a short description for this link"
                className="resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/15 dark:bg-white/5"
              />
            </FieldLabel>
          </>
        ) : (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-400/20 dark:bg-violet-500/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Items in this group</div>
                <div className="mt-1 text-xs text-muted">
                  {item.items.length} {item.items.length === 1 ? "child" : "children"} · level {path.length}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAddChild(path, createLink())}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                + Add link
              </button>
            </div>
            {path.length < 3 ? (
              <button
                type="button"
                onClick={() => onAddChild(path, createGroup())}
                className="mt-3 w-full rounded-xl border border-violet-200 bg-white/70 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-white dark:border-violet-400/20 dark:bg-white/5 dark:text-violet-300"
              >
                + Add nested menu
              </button>
            ) : null}
          </div>
        )}

        <div className="border-t border-black/10 pt-5 dark:border-white/10">
          {confirmingDelete ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-400/20 dark:bg-red-500/10">
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                Delete “{item.label || "Untitled"}”?
              </p>
              <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">
                {item.type === "group" && item.items.length > 0
                  ? `This also removes its ${item.items.length} child items.`
                  : "This item will be removed from the menu."}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onDelete(path)}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Delete item
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold dark:border-red-400/20 dark:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              <ActionIcon name="trash" className="size-4" />
              Delete item
            </button>
          )}
        </div>
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
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="grid max-h-[90vh] w-full max-w-2xl gap-5 overflow-hidden rounded-3xl border border-white/20 bg-white p-5 shadow-2xl dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Choose destination</h2>
            <p className="mt-1 text-sm text-muted">Select an internal page or paste an external URL.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close destination picker"
            className="grid size-9 place-items-center rounded-full bg-black/5 text-lg hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
          >
            ×
          </button>
        </div>

        <FieldLabel>
          External URL
          <div className="flex gap-2">
            <input
              value={externalHref}
              onChange={(event) => setExternalHref(event.target.value)}
              placeholder="https://example.com"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-black/10 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/15 dark:bg-white/5"
            />
            <button
              type="button"
              onClick={() => {
                onChoose(externalHref);
                onClose();
              }}
              disabled={!externalHref.trim()}
              className="rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              Apply
            </button>
          </div>
        </FieldLabel>

        <div className="grid min-h-0 gap-3">
          <div className="relative">
            <MenuIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search internal pages..."
              autoFocus
              className="min-h-11 w-full rounded-xl border border-black/10 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-white/15 dark:bg-white/5"
            />
          </div>
          <div className="grid max-h-[48vh] gap-1 overflow-auto rounded-2xl border border-black/10 p-2 dark:border-white/10">
            {filteredRoutes.map((route) => (
              <button
                key={route}
                type="button"
                onClick={() => {
                  onChoose(route);
                  onClose();
                }}
                className={`rounded-xl px-3 py-2.5 text-left font-mono text-xs transition ${
                  currentHref === route
                    ? "bg-blue-600 text-white"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {route}
              </button>
            ))}
            {filteredRoutes.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">No matching page found.</div>
            ) : null}
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
  const startingMenus = initialMenus ?? emptyMenus;
  const [menus, setMenus] = useState<EditableMenus>(startingMenus);
  const [activeMenu, setActiveMenu] = useState<MenuKey>("site");
  const [status, setStatus] = useState("Loaded.");
  const [saving, setSaving] = useState(false);
  const [selectedPath, setSelectedPath] = useState<Path | null>(
    startingMenus.site.primary.length > 0 ? [0] : null,
  );
  const [hrefPickerPath, setHrefPickerPath] = useState<Path | null>(null);
  const [query, setQuery] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const pendingMoveRef = useRef<PendingMove | null>(null);
  const lastSavedMenusRef = useRef(JSON.stringify(startingMenus));
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
    setSelectedPath(data.menus[activeMenu].primary.length > 0 ? [0] : null);
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
    setSelectedPath(nextPath);
    setQuery("");
  }

  function handleAddChild(path: Path, item: MenuItem) {
    const parent = getAtPath(menus[activeMenu].primary, path);
    if (parent?.type !== "group" || path.length >= 3) return;
    const nextPath = [...path, parent.items.length];
    updateActiveMenu((menu) => ({
      ...menu,
      primary: updateAtPath(menu.primary, path, (target) => {
        if (target.type !== "group") return target;
        return { ...target, items: [...target.items, item] };
      }),
    }));
    setCollapsedPaths((current) => {
      const next = new Set(current);
      next.delete(pathKey(path));
      return next;
    });
    setSelectedPath(nextPath);
    setQuery("");
  }

  function handleDelete(path: Path) {
    const parentPath = path.slice(0, -1);
    const index = path[path.length - 1];
    updateActiveMenu((menu) => ({
      ...menu,
      primary: updateListAtPath(menu.primary, parentPath, (items) => items.filter((_, i) => i !== index)),
    }));
    setSelectedPath(parentPath.length > 0 ? parentPath : null);
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
    if (samePath(selectedPath, path)) setSelectedPath(targetPath);
  }

  function chooseHref(path: Path, href: string) {
    const item = getAtPath(menus[activeMenu].primary, path);
    handleChange(path, item?.type === "link" ? { ...item, href } : createLink());
  }

  function switchMenu(key: MenuKey) {
    setActiveMenu(key);
    setSelectedPath(menus[key].primary.length > 0 ? [0] : null);
    setHrefPickerPath(null);
    setQuery("");
    setCollapsedPaths(new Set());
  }

  function toggleCollapsed(path: Path) {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      const key = pathKey(path);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const active = menus[activeMenu];
  const selectedItem = selectedPath ? getAtPath(active.primary, selectedPath) : null;
  const hrefPickerItem = hrefPickerPath ? getAtPath(active.primary, hrefPickerPath) : null;
  const normalizedQuery = query.trim().toLowerCase();
  const stats = useMemo(() => countMenuItems(active.primary), [active.primary]);
  const groupPaths = useMemo(() => collectGroupPaths(active.primary), [active.primary]);
  const breadcrumbs = selectedPath ? getBreadcrumbs(active.primary, selectedPath) : [];
  const visibleRootCount = active.primary.filter((item) => itemContainsQuery(item, normalizedQuery)).length;
  const statusTone = saving
    ? "bg-sky-500"
    : status.toLowerCase().includes("failed")
      ? "bg-red-500"
      : status === "Saved." || status === "Loaded."
        ? "bg-emerald-500"
        : "bg-amber-500";

  return (
    <main className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur dark:border-white/10 dark:bg-neutral-950/95"
      >
        <span className={`size-2 rounded-full ${statusTone} ${saving ? "animate-pulse" : ""}`} aria-hidden />
        {saving ? "Saving changes…" : status}
      </div>

      <section className="overflow-hidden rounded-[28px] border border-black/[0.06] bg-gradient-to-br from-white via-white to-blue-50/80 p-5 shadow-[0_20px_70px_rgba(30,64,175,0.08)] dark:border-white/10 dark:from-neutral-900 dark:via-neutral-900 dark:to-blue-950/30 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <MenuIcon name="app" className="size-6" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                Navigation studio
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Menu Manager</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Shape your navigation, organize nested menus, and edit every destination from one focused workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadMenus()}
            className="rounded-xl border border-black/10 bg-white/80 px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/15 dark:bg-white/5"
          >
            ↻ Reload config
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.06] pt-5 dark:border-white/10">
          <div
            role="tablist"
            aria-label="Menu selection"
            className="inline-flex rounded-xl bg-black/[0.045] p-1 dark:bg-white/[0.07]"
          >
            {(["site", "dashboard"] as MenuKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={activeMenu === key}
                onClick={() => switchMenu(key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeMenu === key
                    ? "bg-white text-neutral-950 shadow-sm dark:bg-white dark:text-neutral-950"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {key === "site" ? "Site menu" : "Admin menu"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-black/[0.045] px-3 py-1.5 font-semibold dark:bg-white/[0.07]">
              {stats.links} links
            </span>
            <span className="rounded-full bg-black/[0.045] px-3 py-1.5 font-semibold dark:bg-white/[0.07]">
              {stats.groups} groups
            </span>
            <span className="rounded-full bg-blue-100 px-3 py-1.5 font-semibold text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
              Up to 3 levels
            </span>
          </div>
        </div>
      </section>

      <section className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <div className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_16px_50px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900">
          <div className="border-b border-black/[0.07] p-4 dark:border-white/10 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Menu structure</h2>
                <p className="mt-1 text-xs text-muted">
                  {active.id} · {stats.total} items
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleAddRoot(createLink())}
                  className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  + New link
                </button>
                <button
                  type="button"
                  onClick={() => handleAddRoot(createGroup())}
                  className="rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold transition hover:bg-black/[0.03] dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  + New menu
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="relative min-w-52 flex-1">
                <MenuIcon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a label or destination…"
                  className="min-h-10 w-full rounded-xl border border-black/10 bg-black/[0.018] pl-10 pr-9 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/[0.07]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCollapsedPaths(
                    collapsedPaths.size === groupPaths.length ? new Set() : new Set(groupPaths),
                  )
                }
                disabled={groupPaths.length === 0}
                className="rounded-xl border border-black/10 px-3 py-2 text-xs font-semibold transition hover:bg-black/[0.03] disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/5"
              >
                {collapsedPaths.size === groupPaths.length ? "Expand all" : "Collapse all"}
              </button>
            </div>
          </div>

          <div className="max-h-[68vh] min-h-[420px] overflow-auto">
            {active.primary.map((item, index) => (
              <MenuTreeItem
                key={index}
                item={item}
                path={[index]}
                depth={0}
                siblingCount={active.primary.length}
                selectedPath={selectedPath}
                collapsedPaths={collapsedPaths}
                query={normalizedQuery}
                onSelect={setSelectedPath}
                onToggle={toggleCollapsed}
                onAddChild={handleAddChild}
                onMove={handleMove}
              />
            ))}
            {active.primary.length === 0 ? (
              <div className="grid min-h-[420px] place-items-center p-8 text-center">
                <div>
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                    <MenuIcon name="link" className="size-6" />
                  </div>
                  <h3 className="mt-4 font-semibold">Start your menu</h3>
                  <p className="mt-2 text-sm text-muted">Add a link or a group to build the first level.</p>
                </div>
              </div>
            ) : normalizedQuery && visibleRootCount === 0 ? (
              <div className="grid min-h-80 place-items-center p-8 text-center">
                <div>
                  <h3 className="font-semibold">No matching menu item</h3>
                  <p className="mt-2 text-sm text-muted">Try a different label or destination.</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Clear search
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.07] bg-black/[0.018] px-4 py-3 text-[11px] text-muted dark:border-white/10 dark:bg-white/[0.025]">
            <span>Select an item to edit it. Use arrows to reorder within its current level.</span>
            <span>Changes save automatically</span>
          </div>
        </div>

        <aside className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_16px_50px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-neutral-900 lg:sticky lg:top-24">
          <ItemInspector
            key={selectedPath ? pathKey(selectedPath) : "none"}
            item={selectedItem}
            path={selectedPath}
            breadcrumbs={breadcrumbs}
            iconNames={iconNames}
            onChange={handleChange}
            onAddChild={handleAddChild}
            onDelete={handleDelete}
            onOpenHrefPicker={setHrefPickerPath}
          />
        </aside>
      </section>

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
