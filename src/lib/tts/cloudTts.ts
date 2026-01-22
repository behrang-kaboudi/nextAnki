import "server-only";

import fs from "node:fs";
import path from "node:path";

import axios from "axios";
import OpenAI from "openai";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

type TtsLang = "fa" | "en" | "both";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function splitTextForSsml(text: string): string[] {
  const segments =
    text.match(
      /(?:[\u0600-\u06FF\u200C‌،؛.!؟…\u2026]+(?:\s+[\u0600-\u06FF\u200C‌،؛.!؟…\u2026]+)*)|(?:[a-zA-Z0-9.,'":;!?…\u2026-]+(?:\s+[a-zA-Z0-9.,'":;!?…\u2026-]+)*)/g
    ) ?? [];

  const cleaned: string[] = [];
  for (const seg of segments.map((s) => s.trim()).filter(Boolean)) {
    if (/^[.,!?؟؛:،…\u2026]+$/.test(seg) && cleaned.length) {
      cleaned[cleaned.length - 1] += seg;
      continue;
    }

    if (/[\u0600-\u06FFa-zA-Z0-9]/.test(seg)) {
      const last = cleaned[cleaned.length - 1];

      const bothPersian =
        last &&
        /^[\u0600-\u06FF\s‌،؛.!؟…\u2026]+$/.test(last) &&
        /^[\u0600-\u06FF\s‌،؛.!؟…\u2026]+$/.test(seg);

      const bothEnglish =
        last &&
        /^[a-zA-Z0-9\s.,'":;!?…\u2026-]+$/.test(last) &&
        /^[a-zA-Z0-9\s.,'":;!?…\u2026-]+$/.test(seg);

      if (bothPersian || bothEnglish) {
        cleaned[cleaned.length - 1] = `${last} ${seg}`;
      } else {
        cleaned.push(seg);
      }
    }
  }

  return cleaned;
}

function createAzureSsml(parts: string[]) {
  const voiceFa = process.env.AZURE_TTS_VOICE_FA ?? "fa-IR-FaridNeural";
  const voiceEn = process.env.AZURE_TTS_VOICE_EN ?? "en-US-GuyNeural";

  let ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" version="1.0" xml:lang="fa-IR">`;
  for (const part of parts) {
    const isEnglish = /[a-zA-Z]/.test(part);
    const voice = isEnglish ? voiceEn : voiceFa;
    const rate = isEnglish ? 0.9 : 0.95;
    ssml += `\n  <voice name="${voice}"><prosody rate="${rate}">${part.trim()}</prosody></voice>`;
  }
  ssml += "\n</speak>";
  return ssml;
}

export async function azureSsmlToMp3(ssml: string, outputPath: string) {
  const region = requiredEnv("AZURE_SPEECH_REGION");
  const key = requiredEnv("AZURE_SPEECH_KEY");

  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

  ensureDirForFile(outputPath);
  const res = await axios.post(url, ssml, {
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
    },
    responseType: "arraybuffer",
    timeout: 15000,
  });

  fs.writeFileSync(outputPath, res.data);
  return outputPath;
}

export async function textToMp3Azure(
  text: string,
  outputPath: string,
  language: TtsLang = "both"
) {
  const raw = (text ?? "").trim();
  if (!raw) throw new Error("text is empty");

  const parts =
    language === "both"
      ? splitTextForSsml(raw)
      : [raw];

  const ssml = createAzureSsml(parts);
  return azureSsmlToMp3(ssml, outputPath);
}

export async function textToMp3Polly(text: string, outputPath: string) {
  const raw = (text ?? "").trim();
  if (!raw) throw new Error("text is empty");

  const polly = new PollyClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: requiredEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });

  ensureDirForFile(outputPath);
  const command = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    Text: raw,
    VoiceId: "Joanna",
    Engine: "neural",
    LanguageCode: "en-US",
  });

  const response = await polly.send(command);
  fs.writeFileSync(
    outputPath,
    Buffer.from(await response.AudioStream.transformToByteArray())
  );
  return outputPath;
}

export async function textToMp3OpenAI(text: string, outputPath: string) {
  const raw = (text ?? "").trim();
  if (!raw) throw new Error("text is empty");

  const client = new OpenAI({ apiKey: requiredEnv("OPENAI_API_KEY") });
  ensureDirForFile(outputPath);

  const response = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "nova",
    format: "mp3",
    input: raw,
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

export async function generateSpeechFromMixedText(
  text: string,
  outputFileUnderPublicAudio: string,
  provider: "azure" | "openai" | "polly" = "azure"
) {
  await delay(20);
  const outputPath = path.join(
    process.cwd(),
    "public",
    "audio",
    outputFileUnderPublicAudio
  );

  if (provider === "azure") return textToMp3Azure(text, outputPath, "both");
  if (provider === "openai") return textToMp3OpenAI(text, outputPath);
  return textToMp3Polly(text, outputPath);
}

