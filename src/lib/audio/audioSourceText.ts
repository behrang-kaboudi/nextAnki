export function normalizedAudioSourceText(text: string | null | undefined): string {
  return String(text ?? "").trim();
}

export type AudioGenerationReason = "missing-file" | "changed-text";

export function getAudioGenerationReason({
  text,
  sourceText,
  fileSize,
}: {
  text: string | null | undefined;
  sourceText: string | null | undefined;
  fileSize: number;
}): AudioGenerationReason | null {
  const currentText = normalizedAudioSourceText(text);
  if (!currentText) return null;
  if (fileSize <= 0) return "missing-file";
  return sourceText !== currentText ? "changed-text" : null;
}

export function audioNeedsGeneration({
  text,
  sourceText,
  fileSize,
}: {
  text: string | null | undefined;
  sourceText: string | null | undefined;
  fileSize: number;
}): boolean {
  return getAudioGenerationReason({ text, sourceText, fileSize }) !== null;
}
