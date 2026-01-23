"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import { ankiRequest, ankiRequestDetailed, type AnkiNotesInfo } from "@/lib/AnkiConnect";
import { WordAnkiConstants } from "@/lib/AnkiDeck/constants";
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

function stripSoundTags(value: string): string {
  const cleaned = value.replace(/\[sound:[^\]]+\]/g, "").replace(/\s+/g, " ").trim();
  return cleaned;
}

export default function AnkiNotePage() {
  const [ankiLinkId, setAnkiLinkId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notesInfo, setNotesInfo] = useState<AnkiNotesInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browseLimit, setBrowseLimit] = useState(50);
  const [browseQueryExtra, setBrowseQueryExtra] = useState("");
  const [openNoteIds, setOpenNoteIds] = useState<Record<number, boolean>>({});
  const [updatingNoteIds, setUpdatingNoteIds] = useState<Record<number, boolean>>({});
  const [updateErrors, setUpdateErrors] = useState<Record<number, string | null>>({});
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);
  const [modelFields, setModelFields] = useState<string[] | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [syncAllStatusText, setSyncAllStatusText] = useState<string | null>(null);
  const [syncAllRunning, setSyncAllRunning] = useState(false);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);

  const queries = useMemo(() => buildQueries(ankiLinkId), [ankiLinkId]);

  async function handleSearch() {
    setIsLoading(true);
    setError(null);
    setNotesInfo(null);
    setOpenNoteIds({});

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

  async function browseMainNotes() {
    setIsLoading(true);
    setError(null);
    setNotesInfo(null);
    setOpenNoteIds({});
    setUpdatingNoteIds({});
    setUpdateErrors({});

    try {
      const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
      const limit = Math.max(1, Math.min(500, Math.trunc(Number(browseLimit) || 50)));
      const extra = browseQueryExtra.trim();
      const query = [`note:"${modelName.replaceAll('"', '\\"')}"`, extra].filter(Boolean).join(" ");

      const idsRes = await ankiRequestDetailed("findNotes", { query });
      if (!idsRes.ok) {
        setError(idsRes.error);
        return;
      }

      const ids = idsRes.result ?? [];
      if (ids.length === 0) {
        setError(`No notes found for model ${modelName}.`);
        return;
      }

      const sliced = ids.length > limit ? ids.slice(-limit) : ids;
      const infoRes = await ankiRequestDetailed("notesInfo", { notes: sliced });
      if (!infoRes.ok) {
        setError(infoRes.error);
        return;
      }
      if (!infoRes.result) {
        setError("Empty result from AnkiConnect (notesInfo).");
        return;
      }

      setNotesInfo(infoRes.result);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateHintSentence(noteId: number) {
    if (updatingNoteIds[noteId]) return;

    setUpdatingNoteIds((p) => ({ ...p, [noteId]: true }));
    setUpdateErrors((p) => ({ ...p, [noteId]: null }));

    try {
      const res = await fetch("/api/anki/hint-sentence/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; note?: AnkiNotesInfo[number]; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.note) {
        setUpdateErrors((p) => ({ ...p, [noteId]: data?.error || `Request failed (${res.status})` }));
        return;
      }
      const updated = data.note;

      setNotesInfo((prev) => {
        if (!prev) return prev;
        return prev.map((n) => (n.noteId === noteId ? updated : n));
      });
    } finally {
      setUpdatingNoteIds((p) => ({ ...p, [noteId]: false }));
    }
  }

  async function pollSyncAll() {
    const res = await fetch("/api/anki/hint-sentence/sync-all", { method: "GET" });
    const data = (await res.json().catch(() => null)) as
      | {
          ok?: boolean;
          status?: {
            jobId: string;
            running: boolean;
            done: boolean;
            error: string | null;
            stopRequested?: boolean;
            stoppedEarly?: boolean;
            total: number;
            processed: number;
            updated: number;
            skipped: number;
            failed: number;
            currentNoteId: number | null;
          };
          error?: string;
        }
      | null;
    if (!res.ok || !data?.ok || !data.status) throw new Error(data?.error || "Failed to fetch sync-all status");

    setSyncAllRunning(Boolean(data.status.running));
    setSyncAllError(data.status.error);
    const remaining = Math.max(0, (data.status.total ?? 0) - (data.status.processed ?? 0));
    setSyncAllStatusText(
      `done=${data.status.processed}/${data.status.total} remaining=${remaining} currentNoteId=${data.status.currentNoteId ?? "—"} updated=${data.status.updated} skipped=${data.status.skipped} failed=${data.status.failed} stopRequested=${data.status.stopRequested ? "yes" : "no"}`
    );
  }

  async function startSyncAll() {
    setSyncAllError(null);
    setSyncAllStatusText(null);
    setSyncAllRunning(true);
    try {
      const res = await fetch("/api/anki/hint-sentence/sync-all", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      await pollSyncAll();
    } catch (e) {
      setSyncAllError(e instanceof Error ? e.message : String(e));
      setSyncAllRunning(false);
    }
  }

  async function requestStopSyncAll() {
    try {
      const res = await fetch("/api/anki/hint-sentence/sync-all", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      await pollSyncAll();
    } catch (e) {
      setSyncAllError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (!syncAllRunning) return;
    const t = setInterval(() => {
      void pollSyncAll().catch(() => null);
    }, 1000);
    return () => clearInterval(t);
  }, [syncAllRunning]);

  async function openFieldsModal() {
    setFieldsModalOpen(true);
    setModelError(null);
    setModelFields(null);
    await fetchModelFields();
  }

  async function fetchModelFields() {
    setModelError(null);
    setModelFields(null);
    setModelBusy(true);
    try {
      const fieldsRes = await ankiRequestDetailed("modelFieldNames", {
        modelName: WordAnkiConstants.noteTypes.META_LEX_VR9,
      });
      if (!fieldsRes.ok) {
        setModelError(fieldsRes.error);
        return;
      }
      if (!fieldsRes.result) {
        setModelError("Empty result from AnkiConnect (modelFieldNames).");
        return;
      }
      setModelFields(fieldsRes.result);
    } finally {
      setModelBusy(false);
    }
  }

  async function ensureHintSentenceField() {
    setModelError(null);
    setModelBusy(true);
    try {
      const fieldsRes = await ankiRequestDetailed("modelFieldNames", {
        modelName: WordAnkiConstants.noteTypes.META_LEX_VR9,
      });
      if (!fieldsRes.ok) {
        setModelError(fieldsRes.error);
        return;
      }
      const fields = fieldsRes.result;
      if (!fields) {
        setModelError("Empty result from AnkiConnect (modelFieldNames).");
        return;
      }

      if (fields.includes("hint_sentence")) {
        setModelFields(fields);
        return;
      }

      const addRes = await ankiRequestDetailed("modelFieldAdd", {
        modelName: WordAnkiConstants.noteTypes.META_LEX_VR9,
        fieldName: "hint_sentence",
      });
      if (!addRes.ok) {
        setModelError(addRes.error);
        return;
      }
      if (addRes.result === null) {
        setModelError("modelFieldAdd returned null (check AnkiConnect permissions and model state).");
        return;
      }

      await fetchModelFields();
    } finally {
      setModelBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fetch Note From Anki"
        subtitle="AnkiConnect must be running (port 8765). Searches by `anki_link_id` (or `AnkiLinkId`)."
      />

      <div className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void openFieldsModal()}
            className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            View target note fields
          </button>
        </div>

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

        <div className="mt-4 rounded-xl border border-card bg-background p-3">
          <div className="text-sm font-semibold text-foreground">Browse main notes</div>
          <div className="mt-1 text-xs text-muted">
            Fetches notes of model{" "}
            <span className="font-mono">{WordAnkiConstants.noteTypes.META_LEX_VR9}</span> via AnkiConnect search.
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={String(browseLimit)}
              onChange={(e) => setBrowseLimit(Number(e.target.value))}
              inputMode="numeric"
              placeholder="Limit (e.g. 50)"
              className="h-11 w-full rounded-xl border border-card bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)] sm:w-[160px]"
            />
            <input
              value={browseQueryExtra}
              onChange={(e) => setBrowseQueryExtra(e.target.value)}
              placeholder='Extra query (optional), e.g. deck:"English"'
              className="h-11 w-full rounded-xl border border-card bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="button"
              onClick={() => void browseMainNotes()}
              disabled={isLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              {isLoading ? "Loading..." : "Load"}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void startSyncAll()}
                disabled={syncAllRunning}
                className="h-10 rounded-xl border border-card bg-card px-3 text-sm font-semibold text-foreground hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
              >
                {syncAllRunning ? "Syncing hint_sentence (ALL)..." : "Sync hint_sentence (ALL)"}
              </button>
              {syncAllRunning ? (
                <button
                  type="button"
                  onClick={() => void requestStopSyncAll()}
                  className="h-10 rounded-xl border border-card bg-card px-3 text-sm font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Stop (after current)
                </button>
              ) : null}
              {syncAllError ? (
                <span className="max-w-[420px] truncate text-xs text-red-700" title={syncAllError}>
                  {syncAllError}
                </span>
              ) : null}
            </div>
            {syncAllStatusText ? <div className="text-xs text-muted">{syncAllStatusText}</div> : null}
          </div>
        </div>
      </div>

      {fieldsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-card bg-card p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-foreground">Target note fields</div>
                <div className="mt-1 text-xs text-muted">
                  Reads model fields via AnkiConnect.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFieldsModalOpen(false)}
                className="h-9 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="text-sm">
                Model:{" "}
                <span className="font-mono">{WordAnkiConstants.noteTypes.META_LEX_VR9}</span>
              </div>

              <button
                type="button"
                onClick={() => void ensureHintSentenceField()}
                disabled={modelBusy}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {modelBusy ? "Working..." : "Ensure hint_sentence field"}
              </button>

              {modelError ? (
                <div className="w-full text-sm text-red-700">{modelError}</div>
              ) : null}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-card bg-background p-3">
              {modelFields ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {modelFields.map((f) => (
                    <li key={f} className="font-mono">
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">No fields loaded.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notesInfo ? (
        <div className="rounded-2xl border border-card bg-card p-2 shadow-elevated">
          <div className="overflow-auto rounded-xl border border-card bg-background">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-card">
                  <th className="px-3 py-2 text-left font-semibold text-foreground">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    <span className="font-mono text-xs">base_form</span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    <span className="font-mono text-xs">meaning_fa</span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    <span className="font-mono text-xs">hint_sentence</span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">Fields</th>
                </tr>
              </thead>
              <tbody>
                {notesInfo.map((note, idx) => {
                  const isOpen = Boolean(openNoteIds[note.noteId]);
                  const fieldCount = Object.keys(note.fields ?? {}).length;
                  const baseFormRaw = note.fields?.base_form?.value ?? "";
                  const meaningFaRaw = note.fields?.meaning_fa?.value ?? "";
                  const hintSentenceRaw = note.fields?.hint_sentence?.value ?? "";
                  const baseForm = stripSoundTags(baseFormRaw);
                  const meaningFa = stripSoundTags(meaningFaRaw);
                  const hintSentence = stripSoundTags(hintSentenceRaw);
                  const updating = Boolean(updatingNoteIds[note.noteId]);
                  const updateError = updateErrors[note.noteId] ?? null;
                  return (
                    <Fragment key={note.noteId}>
                      <tr className="border-b border-card">
                        <td className="px-3 py-2 text-muted">{idx + 1}</td>
                        <td className="px-3 py-2 text-foreground">
                          {baseForm ? (
                            <span className="whitespace-pre-wrap" title={baseFormRaw || undefined}>
                              {baseForm}
                            </span>
                          ) : (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {meaningFa ? (
                            <span className="whitespace-pre-wrap" title={meaningFaRaw || undefined}>
                              {meaningFa}
                            </span>
                          ) : (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          <div className="flex flex-col gap-1">
                            <div className="text-foreground">
                              {hintSentence ? (
                                <span className="whitespace-pre-wrap" title={hintSentenceRaw || undefined}>
                                  {hintSentence}
                                </span>
                              ) : (
                                <span className="opacity-60">—</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={updating}
                                onClick={() => void updateHintSentence(note.noteId)}
                                className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                              >
                                {updating ? "Updating..." : "Update"}
                              </button>
                              {updateError ? (
                                <span className="max-w-[260px] truncate text-[11px] text-red-700" title={updateError}>
                                  {updateError}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenNoteIds((prev) => ({ ...prev, [note.noteId]: !Boolean(prev[note.noteId]) }))
                            }
                            className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                          >
                            {isOpen ? "Hide" : "Show"} ({fieldCount})
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-card">
                          <td className="px-3 py-3" />
                          <td className="px-3 py-3" colSpan={4}>
                            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                              <span>
                                Note ID: <span className="font-mono text-foreground">{note.noteId}</span>
                              </span>
                              <span>
                                Model: <span className="text-foreground">{note.modelName}</span>
                              </span>
                              <span className="truncate">
                                Tags:{" "}
                                <span className="text-foreground">
                                  {note.tags?.length ? note.tags.join(", ") : "—"}
                                </span>
                              </span>
                            </div>
                            <div className="overflow-auto rounded-xl border border-card bg-card">
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-card">
                                    <th className="px-3 py-2 text-left font-semibold text-foreground">Field</th>
                                    <th className="px-3 py-2 text-left font-semibold text-foreground">Value</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(note.fields).map(([fieldName, field]) => (
                                    <tr key={fieldName} className="border-b border-card last:border-b-0">
                                      <td className="w-[220px] px-3 py-2 font-mono text-foreground">{fieldName}</td>
                                      <td
                                        className="px-3 py-2 text-foreground whitespace-pre-wrap"
                                        title={field.value || undefined}
                                      >
                                        {field.value ? stripSoundTags(field.value) || "—" : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
