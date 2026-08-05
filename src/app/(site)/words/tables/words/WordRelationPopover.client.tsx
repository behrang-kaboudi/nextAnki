"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type RelationPopoverField = {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
  code?: boolean;
  multiline?: boolean;
};

type PopoverPosition = { top: number; left: number };

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
  const open = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: Math.min(rect.bottom + 6, window.innerHeight - 24),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 440)),
    });
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
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [position]);

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
              className="fixed z-50 max-h-[min(32rem,calc(100vh-2rem))] w-[min(26rem,calc(100vw-1rem))] overflow-auto rounded border bg-background p-3 text-left text-xs shadow-xl"
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
