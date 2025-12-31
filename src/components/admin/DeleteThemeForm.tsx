"use client";

import { useCallback } from "react";

type DeleteThemeFormProps = {
  themeId: number;
  action: (formData: FormData) => void;
  className?: string;
};

export function DeleteThemeForm({ themeId, action, className }: DeleteThemeFormProps) {
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      const ok = window.confirm("Delete this theme? This action cannot be undone.");
      if (!ok) event.preventDefault();
    },
    [],
  );

  return (
    <form action={action} onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="themeId" value={themeId} />
      <button
        type="submit"
        className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
      >
        Delete
      </button>
    </form>
  );
}
