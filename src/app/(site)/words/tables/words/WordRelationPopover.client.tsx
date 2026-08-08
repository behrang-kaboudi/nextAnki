"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type RelationPopoverField = {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
  code?: boolean;
  multiline?: boolean;
};

type PopoverPosition = { top: number; left: number; maxHeight: number };

export default function WordRelationPopover({
  label,
  details,
  children,
}: {
  label: string;
  details: readonly RelationPopoverField[];
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  const close = () => setPosition(null);
  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;

    const margin = 8;
    const gap = 6;
    const anchor = button.getBoundingClientRect();
    const width = Math.min(popover.offsetWidth || 416, window.innerWidth - margin * 2);
    const desiredHeight = Math.min(popover.scrollHeight, window.innerHeight - margin * 2);
    const spaceBelow = window.innerHeight - anchor.bottom - gap - margin;
    const spaceAbove = anchor.top - gap - margin;
    const placeBelow =
      spaceBelow >= Math.min(desiredHeight, 240) || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(96, placeBelow ? spaceBelow : spaceAbove);
    const renderedHeight = Math.min(desiredHeight, maxHeight);
    const top = placeBelow
      ? Math.min(anchor.bottom + gap, window.innerHeight - margin - renderedHeight)
      : Math.max(margin, anchor.top - gap - renderedHeight);
    const preferredLeft =
      anchor.left + width <= window.innerWidth - margin
        ? anchor.left
        : anchor.right - width;
    const left = Math.max(
      margin,
      Math.min(preferredLeft, window.innerWidth - margin - width),
    );

    setPosition((current) =>
      current &&
      current.top === top &&
      current.left === left &&
      current.maxHeight === maxHeight
        ? current
        : { top, left, maxHeight },
    );
  }, []);

  const open = () => {
    setPosition({
      top: 8,
      left: 8,
      maxHeight: Math.max(96, window.innerHeight - 16),
    });
    requestAnimationFrame(updatePosition);
  };

  useEffect(() => {
    if (!position) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      )
        return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [position, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={Boolean(position)}
        onClick={() => (position ? close() : open())}
        className="block max-w-full truncate text-left underline decoration-dotted underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
      >
        {children}
      </button>
      {position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label={label}
              className="fixed z-50 w-[min(26rem,calc(100vw-1rem))] overflow-auto rounded border bg-background p-3 text-left text-xs shadow-xl"
              style={position}
            >
              <div className="mb-2 flex items-center justify-between gap-3 border-b pb-2 font-medium">
                <span>{label}</span>
                <button
                  type="button"
                  onClick={close}
                  className="rounded border px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
              <dl className="space-y-1.5">
                {details.map((detail) =>
                  detail.multiline ? (
                    <div key={detail.label} className="pt-1">
                      <dt className="font-mono opacity-70">{detail.label}</dt>
                      <dd
                        dir={detail.dir}
                        className="mt-0.5 whitespace-pre-wrap break-words rounded bg-black/5 p-2 font-mono dark:bg-white/10"
                      >
                        {detail.value || "—"}
                      </dd>
                    </div>
                  ) : (
                    <div
                      key={detail.label}
                      className="flex items-baseline gap-2"
                    >
                      <dt className="shrink-0 font-mono opacity-70">
                        {detail.label}:
                      </dt>
                      <dd
                        dir={detail.dir}
                        className={`min-w-0 break-words ${detail.code ? "font-mono" : ""}`}
                      >
                        {detail.value || "—"}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
