import fs from "node:fs";
import path from "node:path";

function audioDir() {
  return path.join(process.cwd(), "public", "audio");
}

function listFiles() {
  try {
    return fs.readdirSync(audioDir());
  } catch {
    return [];
  }
}

function isMp3(name) {
  return typeof name === "string" && name.toLowerCase().endsWith(".mp3");
}

function parseOldHintFilename(filename) {
  // old: {id}_{anything}.mp3  (we only trust numeric id prefix)
  const m = /^(?<id>\d+)_.*\.mp3$/i.exec(filename);
  if (!m?.groups?.id) return null;
  const id = Number(m.groups.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { id: Math.trunc(id) };
}

function isNewHintFilenameForId(filename, id) {
  return new RegExp(`^${id}_hint_\\d{8,}\\.mp3$`).test(filename);
}

function nextNameFor(id, ts) {
  return `${id}_hint_${ts}.mp3`;
}

function ensureUniqueName(existingSet, desired) {
  if (!existingSet.has(desired)) return desired;
  const m = /^(?<prefix>\\d+_hint_)(?<ts>\\d+)(?<ext>\\.mp3)$/i.exec(desired);
  const prefix = m?.groups?.prefix ?? "";
  const ts0 = Number(m?.groups?.ts ?? "");
  const ext = m?.groups?.ext ?? ".mp3";
  let ts = Number.isFinite(ts0) ? Math.trunc(ts0) : Date.now();
  for (let i = 0; i < 1000; i++) {
    ts += 1;
    const candidate = `${prefix}${ts}${ext}`;
    if (!existingSet.has(candidate)) return candidate;
  }
  throw new Error(`Failed to find unique name for: ${desired}`);
}

function main() {
  const dir = audioDir();
  const files = listFiles().filter(isMp3);
  const existing = new Set(files);

  let renamed = 0;
  let skippedNoId = 0;
  let skippedAlreadyNew = 0;
  let skippedNewExists = 0;

  for (const filename of files) {
    const parsed = parseOldHintFilename(filename);
    if (!parsed) {
      skippedNoId += 1;
      continue;
    }

    if (isNewHintFilenameForId(filename, parsed.id)) {
      skippedAlreadyNew += 1;
      continue;
    }

    // If there is already a new-format file for this id, keep the old one (avoid ambiguity).
    const hasAnyNewForId = files.some((f) => isNewHintFilenameForId(f, parsed.id));
    if (hasAnyNewForId) {
      skippedNewExists += 1;
      continue;
    }

    const absOld = path.join(dir, filename);
    let st;
    try {
      st = fs.statSync(absOld);
    } catch {
      continue;
    }

    const ts = Math.trunc(Number.isFinite(st.mtimeMs) ? st.mtimeMs : Date.now());
    const desired = nextNameFor(parsed.id, ts);
    const next = ensureUniqueName(existing, desired);
    const absNext = path.join(dir, next);

    fs.renameSync(absOld, absNext);
    existing.delete(filename);
    existing.add(next);
    renamed += 1;
  }

  console.log(
    JSON.stringify(
      { ok: true, renamed, skippedNoId, skippedAlreadyNew, skippedNewExists, dir },
      null,
      2
    )
  );
}

main();

