"use client";

type Props = {
  batchSize: string;
  disabled?: boolean;
  loadedCount?: number;
  totalEligibleCount?: number | null;
  onBatchSizeChange: (value: string) => void;
};

export function PromptBatchControls({
  batchSize,
  disabled = false,
  loadedCount = 0,
  totalEligibleCount = null,
  onBatchSizeChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border bg-black/[0.02] p-2 text-xs dark:bg-white/[0.03]">
      <label className="flex items-center gap-1">
        Count
        <input
          type="number"
          min="0"
          value={batchSize}
          disabled={disabled}
          onChange={(event) => onBatchSizeChange(event.target.value)}
          className="w-24 rounded border px-2 py-1"
        />
      </label>
      <span className="opacity-70">
        {loadedCount.toLocaleString()} loaded
        {totalEligibleCount !== null ? ` of ${totalEligibleCount.toLocaleString()} remaining` : ""}
      </span>
    </div>
  );
}
