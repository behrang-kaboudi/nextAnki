import "server-only";

import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const SHARED_AUDIO_DIR = path.join(process.cwd(), "public", "audio", "anki-media");
export const SHARED_AUDIO_PUBLIC_PATH = "/audio/anki-media";

const AUDIO_ROOT = path.join(process.cwd(), "public", "audio");
const ALLOWED_EXTENSIONS = new Set([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type SharedAudioFile = {
  name: string;
  size: number;
  modifiedAt: string;
  url: string;
};

export function validateAudioFilename(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (!name || name !== path.basename(name) || !SAFE_FILENAME.test(name)) {
    throw new Error("Use only English letters, numbers, dots, dashes, and underscores in the filename.");
  }
  if (!ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase())) {
    throw new Error("Unsupported audio extension.");
  }
  return name;
}

export async function ensureSharedAudioDirectory() {
  await fs.mkdir(SHARED_AUDIO_DIR, { recursive: true });
}

async function findFilenameOutsideManagedDirectory(filename: string) {
  const visit = async (directory: string): Promise<string | null> => {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (absolutePath === SHARED_AUDIO_DIR) continue;
        const found = await visit(absolutePath);
        if (found) return found;
      } else if (entry.isFile() && entry.name === filename) {
        return absolutePath;
      }
    }
    return null;
  };
  return visit(AUDIO_ROOT);
}

export async function assertFilenameAvailable(filename: string, currentName?: string) {
  if (filename !== currentName) {
    const managedPath = path.join(SHARED_AUDIO_DIR, filename);
    const managedExists = await fs.stat(managedPath).then((stat) => stat.isFile()).catch(() => false);
    if (managedExists) throw new Error("A file with this name already exists.");
  }
  const duplicate = await findFilenameOutsideManagedDirectory(filename);
  if (duplicate) throw new Error("This filename is already used elsewhere in public/audio.");
}

export async function listSharedAudioFiles(): Promise<SharedAudioFile[]> {
  await ensureSharedAudioDirectory();
  const entries = await fs.readdir(SHARED_AUDIO_DIR, { withFileTypes: true });
  const rows = await Promise.all(entries.filter((entry) => entry.isFile() && !entry.name.startsWith(".")).map(async (entry) => {
    const stat = await fs.stat(path.join(SHARED_AUDIO_DIR, entry.name));
    return {
      name: entry.name,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      url: `${SHARED_AUDIO_PUBLIC_PATH}/${encodeURIComponent(entry.name)}`,
    };
  }));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveSharedAudioUpload(file: File, requestedName?: unknown) {
  await ensureSharedAudioDirectory();
  const name = validateAudioFilename(requestedName || file.name);
  await assertFilenameAvailable(name);
  if (file.size <= 0) throw new Error("The uploaded file is empty.");
  await fs.writeFile(path.join(SHARED_AUDIO_DIR, name), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return name;
}

export async function saveSharedAudioRecording(file: File, requestedName: unknown, replaceRaw?: unknown) {
  await ensureSharedAudioDirectory();
  const name = validateAudioFilename(requestedName);
  if (path.extname(name).toLowerCase() !== ".mp3") throw new Error("Recorded audio filenames must use the .mp3 extension.");
  if (file.size <= 0) throw new Error("The recording is empty.");
  if (file.size > 15 * 1024 * 1024) throw new Error("The recording is too large (maximum 15 MB).");

  const replaceName = replaceRaw == null || replaceRaw === "" ? null : validateAudioFilename(replaceRaw);
  if (replaceName && replaceName !== name) throw new Error("A recording can only replace the selected filename.");
  if (replaceName) {
    const existing = await fs.stat(path.join(SHARED_AUDIO_DIR, replaceName)).catch(() => null);
    if (!existing?.isFile()) throw new Error("The audio file to replace was not found.");
  } else {
    await assertFilenameAvailable(name);
  }

  const tempInput = path.join(os.tmpdir(), `nextAnki_sharedAudio_${crypto.randomUUID()}.recording`);
  const tempOutput = path.join(SHARED_AUDIO_DIR, `.recording-${crypto.randomUUID()}.mp3`);
  const destination = path.join(SHARED_AUDIO_DIR, name);
  try {
    await fs.writeFile(tempInput, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    await runFfmpeg(["-y", "-i", tempInput, "-vn", "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "128k", tempOutput]);
    if (replaceName) {
      await fs.rename(tempOutput, destination);
    } else {
      await fs.link(tempOutput, destination);
      await fs.unlink(tempOutput);
    }
    return name;
  } finally {
    await Promise.allSettled([
      fs.rm(tempInput, { force: true }),
      fs.rm(tempOutput, { force: true }),
    ]);
  }
}

export async function renameSharedAudioFile(currentRaw: unknown, nextRaw: unknown) {
  await ensureSharedAudioDirectory();
  const currentName = validateAudioFilename(currentRaw);
  const nextName = validateAudioFilename(nextRaw);
  if (currentName === nextName) return nextName;
  await assertFilenameAvailable(nextName, currentName);
  await fs.rename(path.join(SHARED_AUDIO_DIR, currentName), path.join(SHARED_AUDIO_DIR, nextName));
  return nextName;
}

export async function deleteSharedAudioFile(rawName: unknown) {
  await ensureSharedAudioDirectory();
  const name = validateAudioFilename(rawName);
  await fs.unlink(path.join(SHARED_AUDIO_DIR, name));
  return name;
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-1000) || "ffmpeg could not create the silence file."));
    });
  });
}

function readAudioDuration(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      const duration = Number(stdout.trim());
      if (code === 0 && Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error(stderr.slice(-1000) || "ffprobe could not read the audio duration."));
    });
  });
}

export async function editSharedAudioFile(
  rawName: unknown,
  rawStart: unknown,
  rawEnd: unknown,
  rawVolumePercent: unknown,
  rawFadeIn: unknown,
  rawFadeOut: unknown,
) {
  await ensureSharedAudioDirectory();
  const name = validateAudioFilename(rawName);
  const inputPath = path.join(SHARED_AUDIO_DIR, name);
  const duration = await readAudioDuration(inputPath);
  const startSeconds = Number(rawStart ?? 0);
  const endSeconds = rawEnd == null || rawEnd === "" ? duration : Number(rawEnd);
  const volumePercent = Number(rawVolumePercent ?? 100);
  const fadeInSeconds = Number(rawFadeIn ?? 0);
  const fadeOutSeconds = Number(rawFadeOut ?? 0);

  if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds >= duration) {
    throw new Error("The trim start must be within the audio duration.");
  }
  if (!Number.isFinite(endSeconds) || endSeconds <= startSeconds || endSeconds > duration + 0.05) {
    throw new Error("The trim end must be after the start and within the audio duration.");
  }
  if (!Number.isFinite(volumePercent) || volumePercent < 0 || volumePercent > 300) {
    throw new Error("Volume must be between 0% and 300%.");
  }
  if (!Number.isFinite(fadeInSeconds) || !Number.isFinite(fadeOutSeconds) || fadeInSeconds < 0 || fadeOutSeconds < 0) {
    throw new Error("Fade durations cannot be negative.");
  }
  const editedDuration = endSeconds - startSeconds;
  if (fadeInSeconds + fadeOutSeconds > editedDuration) {
    throw new Error("Fade-in and fade-out cannot be longer than the edited audio.");
  }

  const extension = path.extname(name);
  const tempOutput = path.join(SHARED_AUDIO_DIR, `.edit-${crypto.randomUUID()}${extension}`);
  const filters = [
    `atrim=start=${startSeconds}:end=${endSeconds}`,
    "asetpts=PTS-STARTPTS",
    `volume=${volumePercent / 100}`,
  ];
  if (fadeInSeconds > 0) filters.push(`afade=t=in:st=0:d=${fadeInSeconds}`);
  if (fadeOutSeconds > 0) filters.push(`afade=t=out:st=${Math.max(0, editedDuration - fadeOutSeconds)}:d=${fadeOutSeconds}`);

  try {
    await runFfmpeg(["-y", "-i", inputPath, "-vn", "-af", filters.join(","), tempOutput]);
    const outputStat = await fs.stat(tempOutput);
    if (!outputStat.isFile() || outputStat.size <= 0) throw new Error("The edited audio is empty.");
    await fs.rename(tempOutput, inputPath);
    return name;
  } finally {
    await fs.rm(tempOutput, { force: true }).catch(() => undefined);
  }
}

export async function createSilenceFile(rawName: unknown, rawDuration: unknown) {
  await ensureSharedAudioDirectory();
  const name = validateAudioFilename(rawName);
  if (path.extname(name).toLowerCase() !== ".mp3") throw new Error("Silence files must use the .mp3 extension.");
  const durationSeconds = Number(rawDuration);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.1 || durationSeconds > 300) {
    throw new Error("Duration must be between 0.1 and 300 seconds.");
  }
  await assertFilenameAvailable(name);
  const outputPath = path.join(SHARED_AUDIO_DIR, name);
  try {
    await runFfmpeg([
      "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(durationSeconds),
      "-c:a", "libmp3lame", "-b:a", "64k", outputPath,
    ]);
  } catch (error) {
    await fs.rm(outputPath, { force: true }).catch(() => undefined);
    throw error;
  }
  return name;
}
