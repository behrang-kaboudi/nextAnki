"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "create" | "review";
type ResponseItem = { id: number; phonetic_us: string };

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) throw new Error(`${fallback} (HTTP ${response.status}; empty response).`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${fallback} (HTTP ${response.status}; response was not JSON).`);
  }
}

function parseResponse(value: string): ResponseItem[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Response must be a JSON array.");
  const seen = new Set<number>();
  return parsed.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error(`item[${index}] must be an object.`);
    const item = row as Record<string, unknown>;
    if (Object.keys(item).length !== 2 || !("id" in item) || !("phonetic_us" in item)) throw new Error(`item[${index}] must be exactly { id, phonetic_us }.`);
    const id = item.id;
    const phonetic_us = typeof item.phonetic_us === "string" ? item.phonetic_us.trim() : "";
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || !phonetic_us || seen.has(id)) throw new Error(`Invalid or duplicate item at index ${index}.`);
    seen.add(id);
    return { id, phonetic_us };
  });
}

const JSON_INSTRUCTIONS = `INPUT JSON (one object for every EnglishWord record):\n[{"id": 1, "base_form": "example"}]\n\nOUTPUT JSON (return only this array, retaining every id exactly once):\n[{"id": 1, "phonetic_us": "ɪɡzæmpəl"}]\n\nFor this batch response, the outer response must be this JSON array; each phonetic_us value itself must contain IPA only.`;
const REVIEW_JSON_INSTRUCTIONS = `INPUT JSON (one object for every EnglishWord record):\n[{"id": 1, "base_form": "example", "phonetic_us": "ɪɡzæmpəl"}]\n\nOUTPUT JSON: return only the records whose phonetic_us is incorrect, with the corrected value. Do NOT return correct records. If all records are correct, return [].\n[{"id": 1, "phonetic_us": "ɪɡzæmpəl"}]\n\nFor this batch response, the outer response must be this JSON array; each phonetic_us value itself must contain IPA only.`;

export default function EnglishWordPhoneticUsPrompt({ mode = "create" }: { mode?: Mode }) {
  const router = useRouter();
  const review = mode === "review";
  const config = review ? {
    promptInstructions: REVIEW_JSON_INSTRUCTIONS,
    recordsUrl: "/api/words/english-words/phonetic-us-review",
    updateUrl: "/api/words/english-words/phonetic-us-review/update-bulk",
    buttonLabel: "PHASE 3.2 — REVIEW PHONETIC_US",
    title: "phonetic_us Review — EnglishWord",
    description: "Only rows with an existing, unconfirmed phonetic_us are included. Return only incorrect rows with corrected IPA; Apply confirms the full batch.",
    placeholder: '[{"id": 1, "phonetic_us": "ɪɡzæmpəl"}] — or [] when all are correct',
    applyLabel: "APPLY REVIEW",
  } : {
    promptInstructions: JSON_INSTRUCTIONS,
    recordsUrl: "/api/words/english-words/phonetic-us-unconfirmed",
    updateUrl: "/api/words/english-words/phonetic-us-unconfirmed/update-bulk",
    buttonLabel: "PHASE 3.1 — PROMPT FOR: PHONETIC_US",
    title: "phonetic_us Prompt — EnglishWord",
    description: "Only rows without phonetic_us and whose phonetic_us_confirmed is false are included. Applying a valid response keeps those rows unconfirmed for review.",
    placeholder: '[{"id": 1, "phonetic_us": "ɪɡzæmpəl"}]',
    applyLabel: "APPLY PHONETIC_US",
  };
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState("50");
  const [prompt, setPrompt] = useState("");
  const [data, setData] = useState("");
  const [response, setResponse] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [promptResponse, rowsResponse] = await Promise.all([
        fetch(`/api/ai/prompt-file?path=${encodeURIComponent("src/prompts/word-extraction/phonetic_us/rulseV1.md")}`),
        fetch(`${config.recordsUrl}?limit=${encodeURIComponent(limit)}`),
      ]);
      const promptJson = await readJson<{ text?: string; error?: string }>(promptResponse, "Could not load the phonetic_us prompt");
      const rowsJson = await readJson<{ ok?: boolean; items?: unknown; totalUnconfirmed?: number; error?: string }>(rowsResponse, "Could not load unconfirmed rows");
      if (!promptResponse.ok || !promptJson.text) throw new Error(promptJson.error || "Could not load the phonetic_us prompt.");
      if (!rowsResponse.ok || !rowsJson.ok) throw new Error(rowsJson.error || "Could not load unconfirmed rows.");
      setPrompt(`${config.promptInstructions}\n\n${promptJson.text}`);
      setData(JSON.stringify(rowsJson.items ?? [], null, 2));
      setRemaining(typeof rowsJson.totalUnconfirmed === "number" ? rowsJson.totalUnconfirmed : null);
      setNotice("Data created ✓");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setLoading(false); }
  }, [config.promptInstructions, config.recordsUrl, limit]);

  const openModal = async () => {
    setOpen(true); setResponse(""); setNotice(null); await loadData();
  };
  const copy = (value: string, label: string) => void navigator.clipboard.writeText(value).then(() => setNotice(`${label} copied ✓`)).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  const apply = async () => {
    setApplying(true); setError(null); setNotice(null);
    try {
      const items = parseResponse(response);
      const loadedIds = review
        ? (JSON.parse(data) as Array<{ id?: unknown }>).map((item) => item.id).filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
        : [];
      if (review && !loadedIds.length) throw new Error("Create review data before applying it.");
      const result = await fetch(config.updateUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review ? { ids: loadedIds, corrections: items } : items) });
      const json = await readJson<{ ok?: boolean; total?: number; updated?: number; results?: Array<{ ok: boolean; error?: string }>; error?: string }>(result, "Could not update phonetic_us");
      if (!result.ok || !json.ok) throw new Error(json.error || "Could not update phonetic_us.");
      const failed = (json.results ?? []).filter((item) => !item.ok).length;
      setNotice(`Updated ${json.updated ?? 0}/${json.total ?? items.length}${failed ? ` · failed ${failed}` : ""} ✓`);
      setResponse("");
      router.refresh();
      await loadData();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setApplying(false); }
  };

  return <>
    <button type="button" onClick={() => void openModal()} disabled={loading} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{config.buttonLabel}</button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><div className="flex h-[85vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated"><div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold">{config.title}</div><div className="mt-1 text-xs opacity-70">{config.description}</div></div><button type="button" onClick={() => !applying && setOpen(false)} className="rounded border px-2 py-1 text-sm">Close</button></div>{error ? <div className="rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</div> : null}{notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800">{notice}</div> : null}<div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2"><section className="flex min-h-0 flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => copy(prompt, "Prompt")} className="rounded border px-2 py-1 text-xs">Copy prompt</button><button type="button" onClick={() => copy(data, "Data")} className="rounded border px-2 py-1 text-xs">Copy data</button><button type="button" onClick={() => copy(`${prompt}\n\n${data}`, "Prompt and data")} className="rounded border px-2 py-1 text-xs">Copy all</button><label className="flex items-center gap-1 text-xs">Count <input type="number" min="1" value={limit} onChange={(event) => setLimit(event.target.value)} className="w-20 rounded border px-2 py-1" /></label><button type="button" onClick={() => void loadData()} disabled={loading || applying} className="rounded border px-2 py-1 text-xs disabled:opacity-50">{loading ? "Creating…" : "Create data"}</button>{remaining !== null ? <span className="text-xs font-semibold text-amber-700">Unconfirmed: {remaining}</span> : null}</div><textarea readOnly value={`${prompt}${data ? `\n\n${data}` : ""}`} className="min-h-0 flex-1 resize-none rounded border p-3 font-mono text-xs" /></section><section className="flex min-h-0 flex-col gap-2"><div className="text-sm font-semibold">Response JSON</div><textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder={config.placeholder} className="min-h-0 flex-1 resize-none rounded border p-3 font-mono text-xs" /><div className="flex gap-2"><button type="button" onClick={() => void navigator.clipboard.readText().then(setResponse).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))} className="rounded border px-3 py-2 text-sm hover:bg-black/5">Paste response</button><button type="button" onClick={() => void apply()} disabled={!response.trim() || applying} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50">{applying ? "Updating…" : config.applyLabel}</button></div></section></div></div></div> : null}
  </>;
}
