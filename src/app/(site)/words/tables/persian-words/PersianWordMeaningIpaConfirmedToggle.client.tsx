"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/icons/ActionIcon";

export default function PersianWordMeaningIpaConfirmedToggle({
  id,
  confirmed,
  hasMeaningIpa,
}: {
  id: number;
  confirmed: boolean;
  hasMeaningIpa: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(confirmed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextValue = !value;
  const title = value ? "Mark Persian IPA as unconfirmed" : "Confirm Persian IPA";

  const update = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/words/persian-words/${id}/meaning-fa-ipa-confirmed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: nextValue }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        item?: { meaning_fa_IPA_confirmed: boolean };
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok || !payload.item) {
        throw new Error(payload?.error || "Could not update confirmation status.");
      }
      setValue(payload.item.meaning_fa_IPA_confirmed);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className={value ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-semibold text-amber-700 dark:text-amber-400"}>
        {value ? "True" : "False"}
      </span>
      <button
        type="button"
        onClick={() => void update()}
        disabled={busy || (!hasMeaningIpa && nextValue)}
        aria-label={title}
        title={!hasMeaningIpa && nextValue ? "Add Persian IPA before confirming it" : title}
        className="rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        <ActionIcon name={value ? "x" : "check"} />
      </button>
      {error ? <span className="max-w-48 text-xs text-red-700 dark:text-red-400">{error}</span> : null}
    </div>
  );
}
