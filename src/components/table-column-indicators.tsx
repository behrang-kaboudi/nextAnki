"use client";

import { useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

export type TableColumnIndicator = {
  kind: "primary-key" | "foreign-key" | "index" | "unique";
  text: string;
};

const ICONS: Record<TableColumnIndicator["kind"], string> = {
  "primary-key": "🔑",
  "foreign-key": "↗",
  index: "▦",
  unique: "◇",
};

export function TableColumnIndicators({ indicators }: { indicators?: readonly TableColumnIndicator[] }) {
  const [tooltip, setTooltip] = useState<{ text: string; left: number; top: number; below: boolean } | null>(null);
  if (!indicators?.length) return null;

  function showTooltip(text: string, target: HTMLElement) {
    const rect = target.getBoundingClientRect();
    setTooltip({
      text,
      left: Math.min(Math.max(rect.left, 8), window.innerWidth - 264),
      top: rect.top > 72 ? rect.top - 8 : rect.bottom + 8,
      below: rect.top <= 72,
    });
  }

  function onMouseEnter(text: string, event: MouseEvent<HTMLSpanElement>) {
    showTooltip(text, event.currentTarget);
  }

  function onFocus(text: string, event: FocusEvent<HTMLSpanElement>) {
    showTooltip(text, event.currentTarget);
  }

  return (
    <span className="inline-flex gap-1 text-[10px] leading-none" aria-label={indicators.map((indicator) => indicator.text).join("; ")}>
      {indicators.map((indicator) => (
        <span key={`${indicator.kind}-${indicator.text}`} className="inline-flex cursor-default" aria-label={indicator.text} onMouseEnter={(event) => onMouseEnter(indicator.text, event)} onMouseLeave={() => setTooltip(null)} onFocus={(event) => onFocus(indicator.text, event)} onBlur={() => setTooltip(null)} tabIndex={0}>
          <span aria-hidden="true">{ICONS[indicator.kind]}</span>
        </span>
      ))}
      {tooltip ? createPortal(<span role="tooltip" className={`pointer-events-none fixed z-[100] w-max max-w-64 rounded bg-black px-2 py-1 text-left text-[11px] font-normal leading-snug text-white shadow-lg ${tooltip.below ? "" : "-translate-y-full"}`} style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.text}</span>, document.body) : null}
    </span>
  );
}
