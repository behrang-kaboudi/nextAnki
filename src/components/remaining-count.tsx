"use client";

type RemainingCountProps = {
  count: number;
};

export function RemainingCountBadge({ count }: RemainingCountProps) {
  return (
    <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap">
      <span>Remaining</span>
      <span className="inline-flex min-w-6 items-center justify-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300">
        {count.toLocaleString()}
      </span>
    </span>
  );
}

export function RemainingCountButton({
  count,
  onClick,
  disabled = false,
}: RemainingCountProps & {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title="Use all remaining items"
      className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-800 transition active:scale-90 hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300"
    >
      <span>Remaining</span>
      <span className="inline-flex min-w-6 items-center justify-center rounded border border-amber-500/40 bg-background px-1.5 py-0.5 tabular-nums">
        {count.toLocaleString()}
      </span>
    </button>
  );
}
