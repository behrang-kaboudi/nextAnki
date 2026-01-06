export type PictureWordAudioLoudness = {
  rmsDb: number | null;
  peakDb: number | null;
};

function safeSlugPart(input: string) {
  const s = (input ?? "").trim().toLowerCase();
  return s
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function pictureWordAudioKey(phinglish: string, en: string) {
  const a = safeSlugPart(phinglish);
  const b = safeSlugPart(en);
  return `${a}__${b}`;
}

export function pictureWordAudioPrefix(phinglish: string, en: string) {
  return `${pictureWordAudioKey(phinglish, en)}__`;
}

export function buildPictureWordAudioFilename(input: {
  phinglish: string;
  en: string;
  timestampMs: number;
  rmsDb: number | null;
  peakDb: number | null;
  ext: string;
}) {
  const key = pictureWordAudioKey(input.phinglish, input.en);
  const ts = Number.isFinite(input.timestampMs) ? Math.trunc(input.timestampMs) : Date.now();
  const rms = input.rmsDb == null || !Number.isFinite(input.rmsDb) ? "na" : String(Math.round(input.rmsDb * 10));
  const peak = input.peakDb == null || !Number.isFinite(input.peakDb) ? "na" : String(Math.round(input.peakDb * 10));
  const ext = (input.ext || "webm").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${key}__${ts}__r${rms}__p${peak}.${ext}`;
}

export function parsePictureWordAudioFilename(filename: string): {
  key: string | null;
  timestampMs: number | null;
  loudness: PictureWordAudioLoudness;
} {
  // {phinglish}__{en}__{ts}__r{rmsDb10|na}__p{peakDb10|na}.{ext}
  const m = /^(?<a>[a-z0-9-]{1,64})__(?<b>[a-z0-9-]{1,64})__(?<ts>\d{8,})__r(?<rms>-?\d+|na)__p(?<peak>-?\d+|na)\.[a-z0-9]+$/i.exec(
    filename
  );
  if (!m?.groups) return { key: null, timestampMs: null, loudness: { rmsDb: null, peakDb: null } };
  const key = `${m.groups.a}__${m.groups.b}`;
  const ts = Number(m.groups.ts);
  const rms10 = m.groups.rms === "na" ? null : Number(m.groups.rms);
  const peak10 = m.groups.peak === "na" ? null : Number(m.groups.peak);
  return {
    key,
    timestampMs: Number.isFinite(ts) ? ts : null,
    loudness: {
      rmsDb: rms10 == null || !Number.isFinite(rms10) ? null : rms10 / 10,
      peakDb: peak10 == null || !Number.isFinite(peak10) ? null : peak10 / 10,
    },
  };
}

