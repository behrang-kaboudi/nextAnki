/**
 * Removes `<br>` tags from the Anki note field used for linking to DB words.
 *
 * Example:
 *   69404cca7aa46fd41264bdee<br>
 *   => 69404cca7aa46fd41264bdee
 *
 * Usage:
 *   node scripts/anki-strip-br-from-anki-link-id.mjs --apply
 *
 * Notes:
 * - Uses AnkiConnect directly (default http://127.0.0.1:8765).
 * - Scans only the app note type (Meta-LEX-vR9) and updates only notes whose value changes.
 * - Writes a backup JSON of changes under `backups/`.
 */

const ANKI_CONNECT_URL = process.env.ANKI_CONNECT_URL ?? "http://127.0.0.1:8765";
const APPLY = process.argv.includes("--apply");
const CHUNK = Number.parseInt(process.env.CHUNK ?? "100", 10) || 100;

const MODEL_NAME = "Meta-LEX-vR9";
const FIELD_ALIASES = ["anki_link_id", "AnkiLinkId", "ankiLinkId"];

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ankiRequestDetailed(action, params = {}) {
  const res = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });

  const data = await res.json().catch(() => null);
  const error = data?.error ?? null;
  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  if (error) return { ok: false, error: String(error) };
  return { ok: true, result: data?.result ?? null };
}

function pickFieldKey(fields) {
  if (!fields || typeof fields !== "object") return null;
  for (const key of FIELD_ALIASES) {
    if (key in fields) return key;
  }
  return null;
}

function stripBr(value) {
  const s = String(value ?? "");
  const cleaned = s.replace(/<br\s*\/?\s*>/gi, "").trim();
  return cleaned;
}

async function main() {
  process.stdout.write(
    `AnkiConnect=${ANKI_CONNECT_URL} model=${JSON.stringify(MODEL_NAME)} chunk=${CHUNK} apply=${APPLY}\n`
  );

  // Permission is required on some AnkiConnect setups. If denied, we still proceed and show error.
  const perm = await ankiRequestDetailed("requestPermission");
  if (perm.ok) {
    process.stdout.write(`permission=${perm.result?.permission ?? "unknown"}\n`);
  } else {
    process.stdout.write(`permission_request_failed=${perm.error}\n`);
  }

  const query = `note:"${MODEL_NAME}"`;
  const found = await ankiRequestDetailed("findNotes", { query });
  if (!found.ok) throw new Error(`findNotes failed: ${found.error}`);
  const noteIds = Array.isArray(found.result) ? found.result : [];
  process.stdout.write(`found_notes=${noteIds.length}\n`);

  const changes = [];
  let scanned = 0;
  let matched = 0;
  let updated = 0;

  for (let i = 0; i < noteIds.length; i += CHUNK) {
    const batch = noteIds.slice(i, i + CHUNK);
    const info = await ankiRequestDetailed("notesInfo", { notes: batch });
    if (!info.ok) throw new Error(`notesInfo failed: ${info.error}`);

    const notes = Array.isArray(info.result) ? info.result : [];
    for (const note of notes) {
      scanned += 1;
      const fieldKey = pickFieldKey(note?.fields);
      if (!fieldKey) continue;

      const raw = note.fields?.[fieldKey]?.value ?? "";
      const hasBr = typeof raw === "string" && /<br\s*\/?\s*>/i.test(raw);
      if (!hasBr) continue;

      matched += 1;
      const cleaned = stripBr(raw);
      if (cleaned === raw) continue;

      const noteId = note?.noteId;
      changes.push({ noteId, fieldKey, old: raw, next: cleaned });

      if (APPLY) {
        const upd = await ankiRequestDetailed("updateNoteFields", {
          note: { id: noteId, fields: { [fieldKey]: cleaned } },
        });
        if (!upd.ok) {
          process.stderr.write(`updateNoteFields failed for noteId=${noteId}: ${upd.error}\n`);
        } else {
          updated += 1;
        }
      }
    }

    process.stdout.write(
      `progress batch=${Math.floor(i / CHUNK) + 1}/${Math.ceil(noteIds.length / CHUNK)} scanned=${scanned} matched=${matched} updated=${updated}\n`
    );

    // Small delay to keep AnkiConnect happy.
    await sleep(75);
  }

  const backupPath = `backups/anki_link_id_strip_br_${nowStamp()}.json`;
  await fsWriteJson(backupPath, {
    ankiConnectUrl: ANKI_CONNECT_URL,
    modelName: MODEL_NAME,
    apply: APPLY,
    scanned,
    matched,
    updated,
    changes,
  });

  process.stdout.write(`backup=${backupPath}\n`);
  process.stdout.write(`done scanned=${scanned} matched=${matched} updated=${updated}\n`);
}

async function fsWriteJson(path, data) {
  const fs = await import("node:fs/promises");
  await fs.mkdir("backups", { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
