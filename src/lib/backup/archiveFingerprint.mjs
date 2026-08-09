import crypto from "node:crypto";

function normalizeValue(value) {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(normalizeValue(value));
}

function normalizeRows(rows) {
  return rows
    .map((row) => {
      const normalized = normalizeValue(row);
      return { normalized, token: stableStringify(normalized) };
    })
    .sort((left, right) => left.token < right.token ? -1 : left.token > right.token ? 1 : 0)
    .map(({ normalized }) => normalized);
}

export function getArchiveDataFingerprint(archive) {
  if (!archive?.data || typeof archive.data !== "object") {
    throw new Error("Backup file has no data section.");
  }

  const data = Object.fromEntries(
    Object.keys(archive.data)
      .sort()
      .map((key) => {
        const rows = archive.data[key];
        if (!Array.isArray(rows)) throw new Error(`Backup data for ${key} is not an array.`);
        return [key, normalizeRows(rows)];
      })
  );
  const snapshot = {
    formatVersion: archive.formatVersion ?? null,
    manifest: normalizeRows(Array.isArray(archive.manifest) ? archive.manifest : []),
    data,
  };

  return crypto.createHash("sha256").update(stableStringify(snapshot), "utf8").digest("hex");
}

export function archivesHaveSameData(left, right) {
  return getArchiveDataFingerprint(left) === getArchiveDataFingerprint(right);
}

export function parseArchive(archiveText) {
  return JSON.parse(archiveText);
}
