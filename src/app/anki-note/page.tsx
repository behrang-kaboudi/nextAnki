"use client";

import { useMemo, useState } from "react";

import { ankiRequest, type AnkiNotesInfo } from "@/lib/AnkiConnect";
import { PageHeader } from "@/components/page-header";

function buildQueries(ankiLinkId: string) {
  const trimmed = ankiLinkId.trim();
  if (!trimmed) return [];
  const quoted = `"${trimmed.replaceAll('"', '\\"')}"`;
  return [
    `anki_link_id:${trimmed}`,
    `anki_link_id:${quoted}`,
    `AnkiLinkId:${trimmed}`,
    `AnkiLinkId:${quoted}`,
  ];
}

export default function AnkiNotePage() {
  const [ankiLinkId, setAnkiLinkId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notesInfo, setNotesInfo] = useState<AnkiNotesInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queries = useMemo(() => buildQueries(ankiLinkId), [ankiLinkId]);

  async function handleSearch() {
    setIsLoading(true);
    setError(null);
      setNotesInfo(null);

    try {
      if (!ankiLinkId.trim()) {
        setError("Please enter `anki_link_id`.");
        return;
      }

      let noteIds: number[] | null = null;
      for (const query of queries) {
        noteIds = await ankiRequest("findNotes", { query });
        if (noteIds && noteIds.length > 0) break;
      }

      if (!noteIds || noteIds.length === 0) {
        setError("No notes found for this `anki_link_id`.");
        return;
      }

      const info = await ankiRequest("notesInfo", { notes: noteIds });
      if (!info) {
        setError("Failed to read note info from AnkiConnect.");
        return;
      }

      setNotesInfo(info);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fetch Note From Anki"
        subtitle="AnkiConnect must be running (port 8765). Searches by `anki_link_id` (or `AnkiLinkId`)."
      />

      <div className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={ankiLinkId}
          onChange={(e) => setAnkiLinkId(e.target.value)}
          placeholder="Example: 69404cca7aa46fd41264bdee"
          className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)]"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading}
          className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notesInfo ? (
        <div className="space-y-4">
          {notesInfo.map((note) => (
            <section
              key={note.noteId}
              className="rounded-2xl border border-card bg-card p-5 shadow-elevated"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-foreground">
                  Note ID: {note.noteId}
                </div>
                <div className="text-xs text-muted">{note.modelName}</div>
              </div>

              <div className="mt-3 grid gap-2">
                {Object.entries(note.fields).map(([fieldName, field]) => (
                  <div
                    key={fieldName}
                    className="rounded-xl border border-card bg-background p-3"
                  >
                    <div className="text-xs font-semibold text-muted">
                      {fieldName}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {field.value || "—"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
