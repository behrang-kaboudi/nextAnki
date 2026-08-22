import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { GLOBAL_AMERICAN_ENGLISH_POLICY_START } from "@/lib/ai/promptPolicy";

type RenderVars = Record<string, string | number | boolean | null | undefined>;

const PROMPTS_ROOT = path.join(process.cwd(), "src", "prompts");
const GLOBAL_AMERICAN_ENGLISH_POLICY = "_core/american-english-policy-v1.md";

function assertSafeRelativePath(relPath: string) {
  if (path.isAbsolute(relPath)) {
    throw new Error(`Prompt path must be relative: ${relPath}`);
  }
  if (relPath.split(/[\\/]/).some((p) => p === "..")) {
    throw new Error(`Prompt path must not contain '..': ${relPath}`);
  }
}

function resolvePromptPath(relPath: string) {
  assertSafeRelativePath(relPath);
  const abs = path.join(PROMPTS_ROOT, relPath);
  const normalizedRoot = path.normalize(PROMPTS_ROOT + path.sep);
  const normalizedAbs = path.normalize(abs);
  if (!normalizedAbs.startsWith(normalizedRoot)) {
    throw new Error(`Prompt path escapes root: ${relPath}`);
  }
  return abs;
}

function stringifyVarValue(value: RenderVars[string]) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

const INCLUDE_RE = /\{\{\s*>\s*([^\s}]+)\s*\}\}/g;
const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

async function loadText(relPath: string) {
  const abs = resolvePromptPath(relPath);
  return readFile(abs, "utf8");
}

export async function withGlobalAmericanEnglishPolicy(source: string) {
  if (source.includes(GLOBAL_AMERICAN_ENGLISH_POLICY_START)) return source;
  return `${await loadText(GLOBAL_AMERICAN_ENGLISH_POLICY)}\n\n${source}`;
}

function withDefaultMdExtension(relPath: string) {
  const hasExt = path.extname(relPath).length > 0;
  return hasExt ? relPath : `${relPath}.md`;
}

async function resolveIncludes(
  source: string,
  options: { maxDepth: number; stack: string[] }
): Promise<string> {
  if (options.maxDepth <= 0) {
    throw new Error(`Max include depth exceeded. Stack: ${options.stack.join(" -> ")}`);
  }

  const matches = [...source.matchAll(INCLUDE_RE)];
  if (matches.length === 0) return source;

  let out = "";
  let lastIndex = 0;
  for (const match of matches) {
    const full = match[0];
    const start = match.index ?? 0;
    const includePathRaw = match[1] ?? "";
    const includePath = withDefaultMdExtension(includePathRaw);

    out += source.slice(lastIndex, start);

    if (options.stack.includes(includePath)) {
      throw new Error(
        `Circular prompt include detected: ${[...options.stack, includePath].join(" -> ")}`
      );
    }

    const included = await loadText(includePath);
    const includedResolved = await resolveIncludes(included, {
      maxDepth: options.maxDepth - 1,
      stack: [...options.stack, includePath],
    });

    out += includedResolved;
    lastIndex = start + full.length;
  }
  out += source.slice(lastIndex);
  return out;
}

function renderVars(source: string, vars: RenderVars) {
  return source.replace(VAR_RE, (_full, key: string) => {
    const value = vars[key];
    return stringifyVarValue(value);
  });
}

export async function renderPromptFromFile(options: {
  file: string;
  vars?: RenderVars;
  maxIncludeDepth?: number;
  includeGlobalPolicy?: boolean;
}) {
  const vars = options.vars ?? {};
  const maxIncludeDepth = options.maxIncludeDepth ?? 20;

  const file = withDefaultMdExtension(options.file);
  const template = await loadText(file);
  const withIncludes = await resolveIncludes(template, { maxDepth: maxIncludeDepth, stack: [file] });
  const prepared = options.includeGlobalPolicy === false
    ? withIncludes
    : await withGlobalAmericanEnglishPolicy(withIncludes);
  return renderVars(prepared, vars);
}
