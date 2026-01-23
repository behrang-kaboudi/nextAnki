import "server-only";

import fs from "node:fs";

import { createAnkiConnectClient, type AnkiNotesInfo } from "@/lib/AnkiConnect";
import { getPublicAudioFileInfo, getLatestHintSentenceAudioFileForId } from "@/lib/words/hintSentenceVoice";
import { getAnkiNoteAndDbWordByAnkiLinkId } from "@/lib/anki/ankiLink";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function extractFirstSoundFilename(value: string): string | null {
  const m = /\[sound:(?<fn>[^\]]+)\]/i.exec(value);
  const fn = m?.groups?.fn?.trim();
  return fn ? fn : null;
}

function parseHintAudioTimestampFromFilename(wordId: number, filename: string): number | null {
  const re = new RegExp(`^${wordId}_hint_(?<ts>\\d{8,})\\.mp3$`, "i");
  const m = re.exec(filename);
  const ts = Number(m?.groups?.ts);
  return Number.isFinite(ts) ? Math.trunc(ts) : null;
}

function upsertSoundTag(current: string, newFilename: string, wordId: number): string {
  const tag = `[sound:${newFilename}]`;
  const cur = current ?? "";
  const existing = extractFirstSoundFilename(cur);

  if (!existing) {
    const base = cur.trim();
    return base ? `${base} ${tag}` : tag;
  }

  const existingTs = parseHintAudioTimestampFromFilename(wordId, existing);
  const newTs = parseHintAudioTimestampFromFilename(wordId, newFilename);

  // If existing isn't our format, keep it and append ours.
  if (existingTs == null || newTs == null) {
    const base = cur.trim();
    if (base.includes(tag)) return base;
    return base ? `${base} ${tag}` : tag;
  }

  // Replace the first sound tag if ours is newer.
  if (newTs > existingTs) {
    return cur.replace(/\[sound:[^\]]+\]/i, tag);
  }

  return cur;
}

async function uploadHintAudioToAnkiMedia(filename: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const info = getPublicAudioFileInfo(filename);
  if (!info.exists) return { ok: false, error: `Local audio not found: ${filename}` };
  if (info.size === 0) return { ok: false, error: `Local audio is zero-byte: ${filename}` };

  const bytes = fs.readFileSync(info.absPath);
  const data = bytes.toString("base64");
  const anki = createAnkiConnectClient();
  const res = await anki.requestDetailed("storeMediaFile", { filename, data, deleteExisting: true });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export type SyncHintSentenceResult =
  | { ok: true; note: AnkiNotesInfo[number] }
  | { ok: false; error: string };

export async function syncHintSentenceForAnkiNote(noteId: number): Promise<SyncHintSentenceResult> {
  const linked = await getAnkiNoteAndDbWordByAnkiLinkId(noteId);
  if (!linked.ok) return { ok: false, error: linked.error };

  const { note, word } = linked;
  const currentRaw = note.fields?.hint_sentence?.value ?? "";
  const current = currentRaw ?? "";

  const dbHint = asNonEmptyString(word.hint_sentence) ?? "";
  const hasHint = Boolean(asNonEmptyString(current));

  let nextValue = current;

  // If Anki is missing hint_sentence, fill from DB.
  if (!hasHint) {
    nextValue = dbHint || "";
  }

  // If we have a local audio file, ensure newest sound tag is present and media is uploaded.
  const latest = getLatestHintSentenceAudioFileForId(word.id);
  if (latest && latest.size > 0) {
    const maybeUpdated = upsertSoundTag(nextValue, latest.filename, word.id);
    if (maybeUpdated !== nextValue) {
      const upload = await uploadHintAudioToAnkiMedia(latest.filename);
      if (!upload.ok) return { ok: false, error: upload.error };
      nextValue = maybeUpdated;
    } else {
      // still upload if Anki has older sound tag for this id (replace path via timestamp compare)
      const existingFn = extractFirstSoundFilename(nextValue);
      const existingTs = existingFn ? parseHintAudioTimestampFromFilename(word.id, existingFn) : null;
      if (existingTs != null && latest.timestampMs > existingTs) {
        const upload = await uploadHintAudioToAnkiMedia(latest.filename);
        if (!upload.ok) return { ok: false, error: upload.error };
        nextValue = upsertSoundTag(nextValue, latest.filename, word.id);
      }
    }
  }

  if (nextValue !== current) {
    const anki = createAnkiConnectClient();
    const updRes = await anki.requestDetailed("updateNoteFields", {
      note: { id: noteId, fields: { hint_sentence: nextValue } },
    });
    if (!updRes.ok) return { ok: false, error: updRes.error };
  }

  const anki = createAnkiConnectClient();
  const refreshed = await anki.requestDetailed("notesInfo", { notes: [noteId] });
  if (!refreshed.ok) return { ok: false, error: refreshed.error };
  const updatedNote = refreshed.result?.[0];
  if (!updatedNote) return { ok: false, error: "Failed to refresh Anki note (notesInfo)" };
  return { ok: true, note: updatedNote };
}

