"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PhoneticUsConfirmedCell({ id, confirmed }: { id: number; confirmed: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(confirmed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (nextValue: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/words/english-words/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phonetic_us_confirmed: nextValue }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not update confirmation.");
      setValue(nextValue);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update confirmation.");
    } finally {
      setBusy(false);
    }
  };

  return <div><label className="flex w-fit items-center gap-1" title="Confirm phonetic_us"><input type="checkbox" checked={value} disabled={busy} onChange={(event) => void update(event.target.checked)} /><span className="sr-only">phonetic_us confirmed</span></label>{error ? <span className="block max-w-36 truncate text-[11px] text-red-600" title={error}>{error}</span> : null}</div>;
}
