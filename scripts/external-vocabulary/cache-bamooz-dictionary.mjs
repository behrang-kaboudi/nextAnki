import fs from "node:fs";
import path from "node:path";

import { parseBamoozDictionaryHtml } from "./bamooz-parser.mjs";

const SOURCE_FILE = "structurally-valid-vocabulary-working-set.json";
const CACHE_FILE = "external-vocabulary-bamooz-cache.jsonl";
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "true"] = arg.split("=", 2);
  return [key, value];
}));
const limit = Math.max(0, Number.parseInt(args.get("--limit") ?? "0", 10) || 0);
const concurrency = Math.min(6, Math.max(1, Number.parseInt(args.get("--concurrency") ?? "3", 10) || 3));
const retryErrors = args.has("--retry-errors");

function normalizeTerm(value) {
  return value.normalize("NFKC").replace(/[’‘`]/gu, "'").replace(/\s+/gu, " ").trim().toLocaleLowerCase("en-US");
}

function readExisting(filePath) {
  const records = new Map();
  if (!fs.existsSync(filePath)) return records;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    records.set(record.normalized_term, record);
  }
  return records;
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "nextAnki vocabulary research/1.0" },
        signal: AbortSignal.timeout(30_000),
      });
      const html = await response.text();
      if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
      return { status: response.status, html };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

async function main() {
  const sourcePath = path.join(process.cwd(), SOURCE_FILE);
  const cachePath = path.join(process.cwd(), CACHE_FILE);
  const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const terms = [...new Map(catalog.entries.map(([term]) => [normalizeTerm(term), term])).entries()]
    .map(([normalizedTerm, term]) => ({ normalizedTerm, term }));
  const existing = readExisting(cachePath);
  const pending = terms.filter(({ normalizedTerm }) => {
    const record = existing.get(normalizedTerm);
    return !record || (retryErrors && record.fetch_status !== "ok");
  });
  const selected = limit ? pending.slice(0, limit) : pending;
  let cursor = 0;
  let completed = 0;
  let parsed = 0;
  let failed = 0;

  async function worker() {
    while (cursor < selected.length) {
      const item = selected[cursor];
      cursor += 1;
      const url = `https://dic.b-amooz.com/en/dictionary/w?word=${encodeURIComponent(item.term)}`;
      let record;
      try {
        const response = await fetchWithRetry(url);
        const parsedPage = parseBamoozDictionaryHtml(response.html, item.term);
        record = {
          normalized_term: item.normalizedTerm,
          url,
          fetched_at: new Date().toISOString(),
          http_status: response.status,
          fetch_status: response.status === 200 ? "ok" : "http_error",
          ...parsedPage,
        };
        if (record.senses.length) parsed += 1;
        if (record.fetch_status !== "ok") failed += 1;
      } catch (error) {
        failed += 1;
        record = {
          normalized_term: item.normalizedTerm,
          term: item.term,
          url,
          fetched_at: new Date().toISOString(),
          http_status: null,
          fetch_status: "network_error",
          parse_status: "empty",
          description: "",
          senses: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
      fs.appendFileSync(cachePath, `${JSON.stringify(record)}\n`, "utf8");
      completed += 1;
      if (completed % 25 === 0 || completed === selected.length) {
        process.stdout.write(`${JSON.stringify({ completed, selected: selected.length, parsed, failed, remaining_total: pending.length - completed })}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stdout.write(`${JSON.stringify({ done: true, total_terms: terms.length, already_cached: existing.size, processed: completed, parsed, failed, cache: CACHE_FILE })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

