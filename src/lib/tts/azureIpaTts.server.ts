import "server-only";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { azureSsmlToMp3 } from "@/lib/tts/cloudTts";

type AzureIpaInput = {
  written: string;
  ipa: string;
};

function escapeXmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttribute(value: string) {
  return escapeXmlText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createAzureIpaSsml(input: AzureIpaInput) {
  const written = input.written.trim();
  const ipa = input.ipa.trim();
  if (!written) throw new Error("Written text is required.");
  if (!ipa) throw new Error("IPA is required.");
  if (/\s/u.test(ipa)) {
    throw new Error("A single IPA segment cannot contain whitespace.");
  }

  const voice = process.env.AZURE_TTS_VOICE_EN ?? "en-US-JennyNeural";

  return [
    '<speak xmlns="http://www.w3.org/2001/10/synthesis" version="1.0" xml:lang="en-US">',
    `  <voice name="${escapeXmlAttribute(voice)}">`,
    `    <prosody rate="0.9"><phoneme alphabet="ipa" ph="${escapeXmlAttribute(ipa)}">${escapeXmlText(written)}</phoneme></prosody>`,
    "  </voice>",
    "</speak>",
  ].join("\n");
}

export async function synthesizeAzureIpaSegment(input: AzureIpaInput) {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "anki-azure-ipa-"),
  );
  const outputPath = path.join(temporaryDirectory, "segment.mp3");

  try {
    await azureSsmlToMp3(createAzureIpaSsml(input), outputPath);
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
