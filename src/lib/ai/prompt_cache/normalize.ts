import "server-only";

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function stripWeirdControls(s: string): string {
  // Keep \n; remove other control chars that can make cache keys unstable.
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimLineEnds(s: string): string {
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n");
}

function collapseBlankLines(s: string): string {
  // Prevent accidental multiple-empty-line edits from busting cache.
  return s.replace(/\n{3,}/g, "\n\n");
}

export function normalizePromptForCache(prompt: string): string {
  let p = String(prompt ?? "");
  p = stripBom(p);
  p = p.normalize("NFKC");
  p = normalizeNewlines(p);
  p = stripWeirdControls(p);
  p = trimLineEnds(p);
  p = p.trim();
  p = collapseBlankLines(p);
  return `${p}\n`;
}

export function withCachePadding(systemPrompt: string): string {
  // Backwards-compatible name: we no longer add any artificial padding.
  // Keep normalization to reduce accidental cache misses due to whitespace.
  return normalizePromptForCache(systemPrompt);
}
