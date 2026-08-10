export function normalizedAudioSourceText(text: string | null | undefined): string {
  return String(text ?? "").trim();
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
  const currentText = normalizedAudioSourceText(text);
  return Boolean(currentText) && (fileSize <= 0 || sourceText !== currentText);
}
