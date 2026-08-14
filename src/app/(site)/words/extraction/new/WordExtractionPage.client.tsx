"use client";

import { PageHeader } from "@/components/page-header";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { WORD_EXTRACTION_PROMPTS_PHASE3 } from "@/lib/word-extraction/promptSpecs";

const buttonBase =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-semibold tracking-wide shadow-elevated transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:brightness-105 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-elevated";

type PromptModalItem = { path: string; text: string };

export default function WordExtractionPage() {
  const [promptText, setPromptText] = useState(
    [
      "ROLE: Final Meaning Extraction & Sense Generator",
      "",
      "Your task:",
      "Perform the full internal pipeline:",
      "1) normalization of noisy input",
      "2) base_form extraction",
      "3) extraction of meanings_fa, sentence_en, and sentence_en_meaning_fa",
      "4) verification and correction",
      "5) generating final structured sense objects",
      "",
      "FINAL OUTPUT MUST BE:",
      "A JSON array. Each item strictly follows: ...",
    ].join("\n"),
  );

  const [rightText, setRightText] = useState(
    [
      "hi",
      "",
      "فعلاً فقط ظاهر صفحه ساخته شده؛ هیچ دکمه‌ای کاری انجام نمی‌دهد.",
      "بعداً می‌تونی مشخص کنی هر دکمه چه کاری انجام بده.",
    ].join("\n"),
  );

  const [isClipboardBusy, setIsClipboardBusy] = useState(false);
  const [isFinalizeBusy, setIsFinalizeBusy] = useState(false);
  const [isInsertBusy, setIsInsertBusy] = useState(false);
  const [insertReport, setInsertReport] = useState<string | null>(null);
  const [baseMeta] = useState<{
    rules?: { filename: string; version: number };
    guide?: { filename: string; version: number };
  }>({});
  const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);
  const [isBaseModalLoading, setIsBaseModalLoading] = useState(false);
  const [baseModalError, setBaseModalError] = useState<string | null>(null);
  const [baseModalItems, setBaseModalItems] = useState<
    PromptModalItem[]
  >([]);
  const [baseModalCopied, setBaseModalCopied] = useState(false);
  const [isSentenceExtractModalOpen, setIsSentenceExtractModalOpen] =
    useState(false);
  const [sentenceExtractModalKind, setSentenceExtractModalKind] = useState<
    "plain" | "missing"
  >("missing");
  const [isSentenceExtractModalLoading, setIsSentenceExtractModalLoading] =
    useState(false);
  const [sentenceExtractModalError, setSentenceExtractModalError] = useState<
    string | null
  >(null);
  const [sentenceExtractModalItems, setSentenceExtractModalItems] = useState<
    PromptModalItem[]
  >([]);
  const [
    sentenceExtractModalPromptCopied,
    setSentenceExtractModalPromptCopied,
  ] = useState(false);
  const [sentenceExtractModalCopied, setSentenceExtractModalCopied] =
    useState(false);
  const [sentenceExtractModalDataCopied, setSentenceExtractModalDataCopied] =
    useState(false);
  const [sentenceExtractModalTailJson, setSentenceExtractModalTailJson] =
    useState("");
  const [sentenceExtractTailLimit, setSentenceExtractTailLimit] =
    useState("20");
  const [sentenceExtractModalTailCount, setSentenceExtractModalTailCount] =
    useState(0);
  const [
    sentenceExtractModalTailLimitApplied,
    setSentenceExtractModalTailLimitApplied,
  ] = useState(20);
  const [isSentenceInsertBusy, setIsSentenceInsertBusy] = useState(false);
  const [isPhoneticModalOpen, setIsPhoneticModalOpen] = useState(false);
  const [isPhoneticModalLoading, setIsPhoneticModalLoading] = useState(false);
  const [phoneticModalError, setPhoneticModalError] = useState<string | null>(
    null,
  );
  const [phoneticModalItems, setPhoneticModalItems] = useState<
    PromptModalItem[]
  >([]);
  const [phoneticModalTailJson, setPhoneticModalTailJson] =
    useState<string>("");
  const [phoneticModalCopied, setPhoneticModalCopied] = useState(false);
  const [phoneticModalPromptCopied, setPhoneticModalPromptCopied] =
    useState(false);
  const [phoneticModalDataCopied, setPhoneticModalDataCopied] = useState(false);
  const [meaningFaIpaTailLimit, setMeaningFaIpaTailLimit] =
    useState<string>("20");
  const [phoneticModalTailCount, setPhoneticModalTailCount] = useState(0);
  const [phoneticModalTailLimitApplied, setPhoneticModalTailLimitApplied] =
    useState(20);
  const [isMeaningIpaModalOpen, setIsMeaningIpaModalOpen] = useState(false);
  const [meaningIpaModalError, setMeaningIpaModalError] = useState<
    string | null
  >(null);
  const [isMeaningIpaBulkSaving, setIsMeaningIpaBulkSaving] = useState(false);
  const [meaningIpaRows, setMeaningIpaRows] = useState<
    Array<{
      id: number;
      base_form: string;
      meaning_fa: string;
      dbMeaningIpa: string;
      dbMeaningIpaNormalized: string;
      dbMeaningIpaConfirmed: boolean;
      inputMeaningIpa: string;
      saving: boolean;
      deleting: boolean;
      saveError: string | null;
      saved: boolean;
    }>
  >([]);
  const lastFocusedMeaningIpaInputRef = useRef<HTMLInputElement | null>(null);
  const lastFocusedMeaningIpaIdRef = useRef<number | null>(null);

  const insertMeaningIpaSpecialChar = useCallback((ch: string) => {
    const el = lastFocusedMeaningIpaInputRef.current;
    const id = lastFocusedMeaningIpaIdRef.current;
    if (!el || !id) return;

    const start =
      typeof el.selectionStart === "number"
        ? el.selectionStart
        : el.value.length;
    const end =
      typeof el.selectionEnd === "number" ? el.selectionEnd : el.value.length;
    const nextValue = `${el.value.slice(0, start)}${ch}${el.value.slice(end)}`;

    setMeaningIpaRows((cur) =>
      cur.map((r) =>
        r.id === id ? { ...r, inputMeaningIpa: nextValue, dbMeaningIpaConfirmed: false, saved: false } : r,
      ),
    );

    requestAnimationFrame(() => {
      try {
        el.focus();
        const pos = start + ch.length;
        el.setSelectionRange(pos, pos);
      } catch {
        // ignore
      }
    });
  }, []);

  const [rightDir, setRightDir] = useState<"rtl" | "ltr">("rtl");

  const parseJsonArrayFromText = useCallback((text: string): unknown[] => {
    const trimmed = text.trim();
    const tryParse = (candidate: string): unknown | null => {
      try {
        return JSON.parse(candidate) as unknown;
      } catch {
        return null;
      }
    };

    const direct = tryParse(trimmed);
    if (Array.isArray(direct)) return direct;

    for (let start = 0; start < trimmed.length; start++) {
      if (trimmed[start] !== "[") continue;

      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let end = start; end < trimmed.length; end++) {
        const ch = trimmed[end];

        if (inString) {
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (ch === '"') {
            inString = false;
          }
          continue;
        }

        if (ch === '"') {
          inString = true;
          continue;
        }

        if (ch === "[") {
          depth += 1;
          continue;
        }

        if (ch === "]") {
          depth -= 1;
          if (depth === 0) {
            const sliced = tryParse(trimmed.slice(start, end + 1));
            if (Array.isArray(sliced)) return sliced;
            break;
          }
        }
      }
    }

    throw new Error("Input must contain a JSON array");
  }, []);

  const openBasePromptModal = useCallback(async () => {
    setIsBaseModalOpen(true);
    setIsBaseModalLoading(true);
    setBaseModalError(null);
    setBaseModalCopied(false);
    try {
      const paths = [
        "src/prompts/word-extraction/base/rulseV1.md",
        "src/prompts/word-extraction/base_form/rulseV1.md",
        "src/prompts/word-extraction/meaning_fa/rulseV1.md",
        "src/prompts/word-extraction/sentence_en/rulseV1.md",
        "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
      ];
      const results = await Promise.all(
        paths.map(async (path) => {
          const res = await fetch(
            `/api/ai/prompt-file?path=${encodeURIComponent(path)}`,
            { method: "GET" },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Request failed: ${res.status}`);
          }
          const data = (await res.json()) as { path: string; text: string };
          return { path: data.path, text: data.text };
        }),
      );
      setBaseModalItems(results);
    } catch (error) {
      setBaseModalError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBaseModalLoading(false);
    }
  }, []);

  const openPlainSentencePromptModal = useCallback(async () => {
    setSentenceExtractModalKind("plain");
    setIsSentenceExtractModalOpen(true);
    setIsSentenceExtractModalLoading(true);
    setSentenceExtractModalError(null);
    setSentenceExtractModalPromptCopied(false);
    setSentenceExtractModalCopied(false);
    setSentenceExtractModalDataCopied(false);
    setSentenceExtractModalTailJson("");
    setSentenceExtractModalTailCount(0);
    setSentenceExtractModalTailLimitApplied(0);
    try {
      const paths = [
        "src/prompts/word-extraction/exFromSentencess/rulseV1.md",
        "src/prompts/word-extraction/sentence_en/rulseV1.md",
        "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
      ];
      const results = await Promise.all(
        paths.map(async (path) => {
          const res = await fetch(
            `/api/ai/prompt-file?path=${encodeURIComponent(path)}`,
            { method: "GET" },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Request failed: ${res.status}`);
          }
          const data = (await res.json()) as { path: string; text: string };
          return { path: data.path, text: data.text };
        }),
      );
      setSentenceExtractModalItems(results);
    } catch (error) {
      setSentenceExtractModalError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsSentenceExtractModalLoading(false);
    }
  }, []);

  const openSentenceExtractPromptModal = useCallback(async () => {
    setSentenceExtractModalKind("missing");
    setIsSentenceExtractModalOpen(true);
    setIsSentenceExtractModalLoading(true);
    setSentenceExtractModalError(null);
    setSentenceExtractModalPromptCopied(false);
    setSentenceExtractModalCopied(false);
    setSentenceExtractModalDataCopied(false);
    setSentenceExtractModalTailJson("");
    setSentenceExtractModalTailCount(0);
    try {
      const path =
        "src/prompts/word-extraction/exFromSentencesForTempWords/rulseV1.md";
      const res = await fetch(
        `/api/ai/prompt-file?path=${encodeURIComponent(path)}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
      }
      const data = (await res.json()) as { path: string; text: string };
      setSentenceExtractModalItems([{ path: data.path, text: data.text }]);

      const limitParsed = Number.parseInt(sentenceExtractTailLimit, 10);
      const limit =
        Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(Math.floor(limitParsed), 500)
          : 20;
      setSentenceExtractModalTailLimitApplied(limit);

      const missingRes = await fetch(
        `/api/word-extraction/ex-from-sentences/missing-anki-notes?limit=${encodeURIComponent(
          String(limit),
        )}`,
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: unknown;
      } | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing sentence note rows (${missingRes.status})`,
        );
      }

      const items = Array.isArray(missingJson.items) ? missingJson.items : [];
      setSentenceExtractModalTailCount(items.length);
      setSentenceExtractModalTailJson(JSON.stringify(items, null, 2));
    } catch (error) {
      setSentenceExtractModalError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsSentenceExtractModalLoading(false);
    }
  }, [sentenceExtractTailLimit]);

  const openPhoneticPromptModal = useCallback(async () => {
    setIsPhoneticModalOpen(true);
    setIsPhoneticModalLoading(true);
    setPhoneticModalError(null);
    setPhoneticModalTailJson("");
    setPhoneticModalTailCount(0);
    setPhoneticModalCopied(false);
    setPhoneticModalPromptCopied(false);
    setPhoneticModalDataCopied(false);
    try {
      const paths = [
        "src/prompts/word-extraction/base/inputOutRulseV1 .md",
        "src/prompts/word-extraction/meaning_fa_IPA/rulseV1.md",
      ];
      const results = await Promise.all(
        paths.map(async (path) => {
          const res = await fetch(
            `/api/ai/prompt-file?path=${encodeURIComponent(path)}`,
            { method: "GET" },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Request failed: ${res.status}`);
          }
          const data = (await res.json()) as { path: string; text: string };
          return { path: data.path, text: data.text };
        }),
      );
      setPhoneticModalItems(results);

      const limitParsed = Number.parseInt(meaningFaIpaTailLimit, 10);
      const limit =
        Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(Math.floor(limitParsed), 500)
          : 20;
      setPhoneticModalTailLimitApplied(limit);
      const missingRes = await fetch(
        `/api/word-extraction/phonetic-us/missing-meaning-fa-ipa?limit=${encodeURIComponent(
          String(limit),
        )}`,
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: unknown;
      } | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing meaning_fa_IPA rows (${missingRes.status})`,
        );
      }
      const items = Array.isArray(missingJson.items) ? missingJson.items : [];
      setPhoneticModalTailCount(items.length);
      setPhoneticModalTailJson(JSON.stringify(items, null, 2));
    } catch (error) {
      setPhoneticModalError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsPhoneticModalLoading(false);
    }
  }, [meaningFaIpaTailLimit]);

  const openMeaningIpaUpdateModal = useCallback(async () => {
    setMeaningIpaModalError(null);
    setIsMeaningIpaModalOpen(true);
    setMeaningIpaRows([]);

    try {
      let parsed: unknown[];
      try {
        parsed = parseJsonArrayFromText(promptText);
      } catch {
        parsed = parseJsonArrayFromText(rightText);
      }

      const seen = new Set<number>();
      const inputPairs: Array<{ id: number; meaning_fa_IPA: string }> = [];

      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i] as unknown;
        if (!row || typeof row !== "object") {
          throw new Error(`item[${i}] must be an object`);
        }

        const obj = row as Record<string, unknown>;
        const keys = Object.keys(obj);
        const allowed = ["id", "meaning_fa_IPA"];
        const extra = keys.filter((k) => !allowed.includes(k));
        const missing = allowed.filter((k) => !(k in obj));
        if (keys.length !== allowed.length || extra.length || missing.length) {
          throw new Error(
            `item[${i}] must have exactly fields { id, meaning_fa_IPA }`,
          );
        }

        const id =
          typeof obj.id === "number" && Number.isFinite(obj.id)
            ? Math.trunc(obj.id)
            : null;
        const meaning =
          typeof obj.meaning_fa_IPA === "string"
            ? obj.meaning_fa_IPA.trim()
            : "";
        if (!id || id <= 0)
          throw new Error(`item[${i}].id must be a positive number`);
        if (!meaning)
          throw new Error(
            `item[${i}].meaning_fa_IPA must be a non-empty string`,
          );
        if (seen.has(id)) throw new Error(`Duplicate id in input: ${id}`);
        seen.add(id);
        inputPairs.push({ id, meaning_fa_IPA: meaning });
      }

      const ids = inputPairs.map((p) => p.id);
      const res = await fetch("/api/word-extraction/meaning-fa-ipa/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: Array<{
          id: number;
          base_form: string;
          meaning_fa: string;
          meaning_fa_IPA: string;
          meaning_fa_IPA_normalized: string;
          meaning_fa_IPA_confirmed: boolean;
        }>;
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      const items = Array.isArray(json.items) ? json.items : [];
      const byId = new Map(items.map((it) => [it.id, it]));

      const rows = inputPairs.map((p) => {
        const db = byId.get(p.id);
        if (!db) {
          throw new Error(`WordSense not found in DB for id=${p.id}`);
        }
        return {
          id: db.id,
          base_form: db.base_form,
          meaning_fa: db.meaning_fa,
          dbMeaningIpa: db.meaning_fa_IPA,
          dbMeaningIpaNormalized: db.meaning_fa_IPA_normalized,
          dbMeaningIpaConfirmed: db.meaning_fa_IPA_confirmed,
          inputMeaningIpa: p.meaning_fa_IPA,
          saving: false,
          deleting: false,
          saveError: null,
          saved: false,
        };
      });

      setMeaningIpaRows(rows);
    } catch (e) {
      setMeaningIpaModalError(e instanceof Error ? e.message : String(e));
    }
  }, [parseJsonArrayFromText, promptText, rightText]);

  const helperSpecs = WORD_EXTRACTION_PROMPTS_PHASE3;
  const helperDefaultActiveId =
    helperSpecs.find((s) => s.fieldKey)?.id ??
    "phonetic_us";

  const [isBase2ModalOpen, setIsBase2ModalOpen] = useState(false);
  const [isBase2ModalLoading, setIsBase2ModalLoading] = useState(false);
  const [base2ModalError, setBase2ModalError] = useState<string | null>(null);
  const [base2ModalItems, setBase2ModalItems] = useState<
    PromptModalItem[]
  >([]);
  const [base2ModalTailJson, setBase2ModalTailJson] = useState<string>("");
  const [base2ModalCopied, setBase2ModalCopied] = useState(false);
  const [base2ModalPromptCopied, setBase2ModalPromptCopied] = useState(false);
  const [base2ModalDataCopied, setBase2ModalDataCopied] = useState(false);
  const [phase3TailLimit, setPhase3TailLimit] = useState<string>("20");
  const [base2ModalTailCount, setBase2ModalTailCount] = useState(0);
  const [base2ModalTotalCount, setBase2ModalTotalCount] = useState<
    number | null
  >(null);
  const [base2ModalTailLimitApplied, setBase2ModalTailLimitApplied] =
    useState(20);
  const [isBase2ApplyBusy, setIsBase2ApplyBusy] = useState(false);
  const [isPhase4ApplyBusy, setIsPhase4ApplyBusy] = useState(false);
  const [isPhase4PromptModalOpen, setIsPhase4PromptModalOpen] = useState(false);
  const [isPhase4PromptModalLoading, setIsPhase4PromptModalLoading] =
    useState(false);
  const [isPhase4MissingLoading, setIsPhase4MissingLoading] = useState(false);
  const [phase4TailLimit, setPhase4TailLimit] = useState<string>("500");
  const [phase4PromptModalError, setPhase4PromptModalError] = useState<
    string | null
  >(null);
  const [phase4PromptModalItems, setPhase4PromptModalItems] = useState<
    PromptModalItem[]
  >([]);
  const [phase4PromptModalTailJson, setPhase4PromptModalTailJson] =
    useState<string>("");
  const [phase4MissingReport, setPhase4MissingReport] = useState<string | null>(null);
  const [phase4PromptModalCopied, setPhase4PromptModalCopied] = useState(false);
  const [promptPathModal, setPromptPathModal] = useState<{
    title: string;
    paths: string[];
  } | null>(null);
  const [promptPathModalCopied, setPromptPathModalCopied] = useState(false);
  const [phase4Checked, setPhase4Checked] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        helperSpecs.map((spec) => [
          spec.id,
          spec.id === "base" || spec.id === helperDefaultActiveId,
        ]),
      ),
  );
  const [phase4ActiveId, setPhase4ActiveId] = useState<string>(
    helperDefaultActiveId,
  );
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isHelpModalLoading, setIsHelpModalLoading] = useState(false);
  const [isHelpModalSaving, setIsHelpModalSaving] = useState(false);
  const [helpModalError, setHelpModalError] = useState<string | null>(null);
  const [helpModalText, setHelpModalText] = useState("");
  const [helpModalSavedText, setHelpModalSavedText] = useState("");
  const [helpModalSaveError, setHelpModalSaveError] = useState<string | null>(
    null,
  );
  const [helpModalSaveOk, setHelpModalSaveOk] = useState(false);

  const openPromptPathModal = useCallback(
    (title: string, items: PromptModalItem[]) => {
      setPromptPathModal({
        title,
        paths: items.map((item) => item.path),
      });
      setPromptPathModalCopied(false);
    },
    [],
  );

  const openBase2PromptModal = useCallback(async () => {
    setIsBase2ModalOpen(true);
    setIsBase2ModalLoading(true);
    setBase2ModalError(null);
    setBase2ModalTailJson("");
    setBase2ModalTailCount(0);
    setBase2ModalTotalCount(null);
    setBase2ModalCopied(false);
    setBase2ModalPromptCopied(false);
    setBase2ModalDataCopied(false);
    try {
      const paths = WORD_EXTRACTION_PROMPTS_PHASE3.map((spec) => spec.path);
      const results = await Promise.all(
        paths.map(async (path) => {
          const res = await fetch(
            `/api/ai/prompt-file?path=${encodeURIComponent(path)}`,
            { method: "GET" },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Request failed: ${res.status}`);
          }
          const data = (await res.json()) as { path: string; text: string };
          return { path: data.path, text: data.text };
        }),
      );
      setBase2ModalItems(results);

      const limitParsed = Number.parseInt(phase3TailLimit, 10);
      const limit =
        Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(Math.floor(limitParsed), 500)
          : 20;
      setBase2ModalTailLimitApplied(limit);
      const missingRes = await fetch(
        `/api/word-extraction/base2/missing-phonetic-imageability?limit=${encodeURIComponent(
          String(limit),
        )}`,
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: unknown;
        total?: unknown;
        fetched?: unknown;
        limit?: unknown;
      } | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load Phase 3 missing rows (${missingRes.status})`,
        );
      }
      const items = Array.isArray(missingJson.items) ? missingJson.items : [];
      const total =
        typeof missingJson.total === "number" &&
        Number.isFinite(missingJson.total)
          ? missingJson.total
          : typeof missingJson.total === "string"
            ? Number.parseInt(missingJson.total, 10)
            : typeof missingJson.total === "bigint"
              ? Number(missingJson.total)
              : null;
      setBase2ModalTotalCount(
        Number.isFinite(total ?? NaN) ? (total as number) : null,
      );
      setBase2ModalTailCount(items.length);
      setBase2ModalTailJson(JSON.stringify(items, null, 2));
    } catch (error) {
      setBase2ModalError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsBase2ModalLoading(false);
    }
  }, [phase3TailLimit]);

  const openPhase4PromptModal = useCallback(async () => {
    setIsPhase4PromptModalOpen(true);
    setIsPhase4PromptModalLoading(true);
    setPhase4PromptModalError(null);
    setPhase4PromptModalTailJson("");
    setPhase4MissingReport(null);
    setPhase4PromptModalCopied(false);
    try {
      const paths = helperSpecs.map((spec) => spec.path);
      const results = await Promise.all(
        paths.map(async (path) => {
          const res = await fetch(
            `/api/ai/prompt-file?path=${encodeURIComponent(path)}`,
            { method: "GET" },
          );
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || `Request failed: ${res.status}`);
          }
          const data = (await res.json()) as { path: string; text: string };
          return { path: data.path, text: data.text };
        }),
      );
      setPhase4PromptModalItems(results);

      const limitParsed = Number.parseInt(phase4TailLimit, 10);
      const limit =
        Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(Math.floor(limitParsed), 10000)
          : 500;

      const active =
        helperSpecs.find((s) => s.id === phase4ActiveId) ??
        helperSpecs.find((s) => s.fieldKey) ??
        helperSpecs[0];
      if (!active?.fieldKey) {
        throw new Error("Invalid helper field selection");
      }
      setIsPhase4MissingLoading(true);
      const missingRes = await fetch(
        `/api/word-extraction/helper/missing-by-field?field=${encodeURIComponent(active.fieldKey)}&limit=${encodeURIComponent(String(limit))}`,
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: unknown;
        total?: number;
        fetched?: number;
        limit?: number;
      } | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing helper rows (${missingRes.status})`,
        );
      }
      setPhase4PromptModalTailJson(
        JSON.stringify(missingJson.items ?? [], null, 2),
      );
      setPhase4MissingReport(
        `field: ${active.fieldKey} · total matching: ${missingJson.total ?? 0} · loaded: ${missingJson.fetched ?? 0} · limit: ${missingJson.limit ?? limit}`,
      );
    } catch (error) {
      setPhase4PromptModalError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsPhase4MissingLoading(false);
      setIsPhase4PromptModalLoading(false);
    }
  }, [helperSpecs, phase4ActiveId, phase4TailLimit]);

  const loadPhase4Missing = useCallback(async (fieldKey: string) => {
    setIsPhase4MissingLoading(true);
    setPhase4PromptModalError(null);
    setPhase4MissingReport(null);
    try {
      const limitParsed = Number.parseInt(phase4TailLimit, 10);
      const limit =
        Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(Math.floor(limitParsed), 10000)
          : 500;
      const missingRes = await fetch(
        `/api/word-extraction/helper/missing-by-field?field=${encodeURIComponent(fieldKey)}&limit=${encodeURIComponent(String(limit))}`,
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        items?: unknown;
        total?: number;
        fetched?: number;
        limit?: number;
      } | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing helper rows (${missingRes.status})`,
        );
      }
      setPhase4PromptModalTailJson(
        JSON.stringify(missingJson.items ?? [], null, 2),
      );
      setPhase4MissingReport(
        `field: ${fieldKey} · total matching: ${missingJson.total ?? 0} · loaded: ${missingJson.fetched ?? 0} · limit: ${missingJson.limit ?? limit}`,
      );
    } catch (error) {
      setPhase4PromptModalError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsPhase4MissingLoading(false);
    }
  }, [phase4TailLimit]);

  const buildHelperPromptText = useCallback(() => {
    const checkedSpecs = helperSpecs.filter((s) =>
      Boolean(phase4Checked[s.id]),
    );
    const activeSpec = helperSpecs.find((s) => s.id === phase4ActiveId) ?? null;
    const ordered =
      activeSpec && phase4Checked[activeSpec.id]
        ? [activeSpec, ...checkedSpecs.filter((s) => s.id !== activeSpec.id)]
        : checkedSpecs;

    const combined = ordered
      .map((spec) =>
        phase4PromptModalItems.find((it) => it.path === spec.path)?.text.trim(),
      )
      .filter((t): t is string => Boolean(t && t.length))
      .join("\n\n");

    const tail = phase4PromptModalTailJson
      ? `\n\n${phase4PromptModalTailJson}`
      : "";
    return `${combined}${tail}`;
  }, [
    helperSpecs,
    phase4ActiveId,
    phase4Checked,
    phase4PromptModalItems,
    phase4PromptModalTailJson,
  ]);

  const openHelpModal = useCallback(async () => {
    setIsHelpModalOpen(true);
    setIsHelpModalLoading(true);
    setHelpModalError(null);
    setHelpModalText("");
    setHelpModalSavedText("");
    setHelpModalSaveError(null);
    setHelpModalSaveOk(false);

    try {
      const res = await fetch(
        `/api/help-file?path=${encodeURIComponent("wordExtraction.md")}`,
        { method: "GET" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
      }
      const data = (await res.json()) as { path: string; text: string };
      setHelpModalText(data.text ?? "");
      setHelpModalSavedText(data.text ?? "");
    } catch (e) {
      setHelpModalError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsHelpModalLoading(false);
    }
  }, []);

  const saveHelpModal = useCallback(async () => {
    setIsHelpModalSaving(true);
    setHelpModalSaveError(null);
    setHelpModalSaveOk(false);
    try {
      const res = await fetch("/api/help-file", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: "wordExtraction.md",
          text: helpModalText,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      setHelpModalSavedText(helpModalText);
      setHelpModalSaveOk(true);
      window.setTimeout(() => setHelpModalSaveOk(false), 1200);
    } catch (e) {
      setHelpModalSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsHelpModalSaving(false);
    }
  }, [helpModalText]);

  const applyBase2FromJson = useCallback(async () => {
    setIsBase2ApplyBusy(true);
    try {
      const parsed = JSON.parse(promptText) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(
          "Input must be a JSON array: [{ id, phonetic_us?, imageability?, learning_depth?, productive_target?, pos?, concept_explained_fa? }]",
        );
      }

      const res = await fetch("/api/word-extraction/base2/update-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        updated?: number;
        results?: unknown;
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      const report = `Updated: ${json.updated ?? 0}/${json.total ?? 0}`;
      setInsertReport(report);
      setRightText(
        `${report}\n\n${JSON.stringify(json.results ?? null, null, 2)}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInsertReport("Update failed");
      setRightText(`خطا در UPDATE.\n\n${msg}`);
    } finally {
      setIsBase2ApplyBusy(false);
    }
  }, [promptText]);

  const applyPhase4FromJson = useCallback(async () => {
    setIsPhase4ApplyBusy(true);
    try {
      const parsed = JSON.parse(promptText) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(
          "Input must be a JSON array: [{ id, phonetic_us?, imageability?, learning_depth?, productive_target?, pos?, concept_explained_fa? }]",
        );
      }

      const res = await fetch("/api/word-extraction/base2/update-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        updated?: number;
        results?: unknown;
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      const report = `Updated: ${json.updated ?? 0}/${json.total ?? 0}`;
      setInsertReport(report);
      setRightText(
        `${report}\n\n${JSON.stringify(json.results ?? null, null, 2)}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInsertReport("Update failed");
      setRightText(`خطا در UPDATE.\n\n${msg}`);
    } finally {
      setIsPhase4ApplyBusy(false);
    }
  }, [promptText]);
  async function saveMeaningIpa(id: number, valueRaw: string) {
    setMeaningIpaRows((cur) =>
      cur.map((r) =>
        r.id === id
          ? {
              ...r,
              saving: true,
              deleting: false,
              saveError: null,
              saved: false,
            }
          : r,
      ),
    );

    const value = valueRaw.trim();
    try {
      const res = await fetch("/api/word-extraction/meaning-fa-ipa/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, meaning_fa_IPA: value }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        item?: { meaning_fa_IPA: string; meaning_fa_IPA_normalized: string; meaning_fa_IPA_confirmed: boolean };
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      setMeaningIpaRows((cur) =>
        cur.map((r) =>
          r.id === id
            ? {
                ...r,
                dbMeaningIpa: json.item?.meaning_fa_IPA ?? r.dbMeaningIpa,
                dbMeaningIpaNormalized:
                  json.item?.meaning_fa_IPA_normalized ??
                  r.dbMeaningIpaNormalized,
                dbMeaningIpaConfirmed: json.item?.meaning_fa_IPA_confirmed === true,
                saving: false,
                deleting: false,
                saveError: null,
                saved: true,
              }
            : r,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMeaningIpaRows((cur) =>
        cur.map((r) =>
          r.id === id
            ? {
                ...r,
                saving: false,
                deleting: false,
                saveError: msg,
                saved: false,
              }
            : r,
        ),
      );
    }
  }

  async function deleteMeaningIpaRow(id: number, label: string) {
    const ok = window.confirm(
      `Delete this word?\n\n#${id} — ${label}\n\nThis will also delete its word audio files.`,
    );
    if (!ok) return;

    setMeaningIpaRows((cur) =>
      cur.map((r) =>
        r.id === id
          ? {
              ...r,
              deleting: true,
              saving: false,
              saveError: null,
              saved: false,
            }
          : r,
      ),
    );

    try {
      const res = await fetch("/api/words/editor/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || json?.ok !== true) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      if (lastFocusedMeaningIpaIdRef.current === id) {
        lastFocusedMeaningIpaIdRef.current = null;
        lastFocusedMeaningIpaInputRef.current = null;
      }

      setMeaningIpaRows((cur) => cur.filter((r) => r.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMeaningIpaRows((cur) =>
        cur.map((r) =>
          r.id === id
            ? {
                ...r,
                deleting: false,
                saving: false,
                saveError: msg,
                saved: false,
              }
            : r,
        ),
      );
    }
  }

  async function saveAllMeaningIpa() {
    if (meaningIpaRows.length === 0) return;

    setIsMeaningIpaBulkSaving(true);
    setMeaningIpaRows((cur) =>
      cur.map((r) => ({
        ...r,
        saving: true,
        deleting: false,
        saveError: null,
        saved: false,
      })),
    );

    try {
      const payload = meaningIpaRows.map((r) => ({
        id: r.id,
        meaning_fa_IPA: r.inputMeaningIpa.trim(),
      }));

      const res = await fetch(
        "/api/word-extraction/meaning-fa-ipa/update-bulk",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        updated?: number;
        results?: Array<
          | {
              ok: true;
              id: number;
              meaning_fa_IPA: string;
              meaning_fa_IPA_normalized: string;
              meaning_fa_IPA_confirmed: boolean;
            }
          | { ok: false; id: number; error: string }
        >;
      } | null;
      if (!res.ok || !json?.ok)
        throw new Error(json?.error ?? `Request failed (${res.status})`);

      const resultById = new Map(
        (json.results ?? []).map((item) => [item.id, item]),
      );

      setMeaningIpaRows((cur) =>
        cur.map((r) => {
          const result = resultById.get(r.id);
          if (!result) {
            return {
              ...r,
              saving: false,
              deleting: false,
              saveError: "No result returned for this row",
              saved: false,
            };
          }
          if (!result.ok) {
            return {
              ...r,
              saving: false,
              deleting: false,
              saveError: result.error,
              saved: false,
            };
          }
          return {
            ...r,
            dbMeaningIpa: result.meaning_fa_IPA,
            dbMeaningIpaNormalized: result.meaning_fa_IPA_normalized,
            dbMeaningIpaConfirmed: result.meaning_fa_IPA_confirmed,
            saving: false,
            deleting: false,
            saveError: null,
            saved: true,
          };
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMeaningIpaRows((cur) =>
        cur.map((r) => ({
          ...r,
          saving: false,
          deleting: false,
          saveError: r.saveError ?? msg,
          saved: false,
        })),
      );
    } finally {
      setIsMeaningIpaBulkSaving(false);
    }
  }

  const copyPromptToClipboard = useCallback(async () => {
    setIsClipboardBusy(true);
    try {
      await navigator.clipboard.writeText(promptText);
      setRightText("متن پرامپت در کلیپ‌بورد کپی شد.");
    } catch (error) {
      setRightText(
        `خطا در کپی به کلیپ‌بورد.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsClipboardBusy(false);
    }
  }, [promptText]);

  const pastePromptFromClipboard = useCallback(async () => {
    setIsClipboardBusy(true);
    try {
      const text = await navigator.clipboard.readText();
      setPromptText(text);
      setRightText("متن از کلیپ‌بورد در پرامپت قرار گرفت.");
    } catch (error) {
      setRightText(
        `خطا در خواندن از کلیپ‌بورد.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsClipboardBusy(false);
    }
  }, []);

  const finalize = useCallback(async () => {
    setIsFinalizeBusy(true);
    setInsertReport(null);
    try {
      const res = await fetch("/api/word-extraction/finalize", {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as unknown;
      const obj =
        json && typeof json === "object"
          ? (json as Record<string, unknown>)
          : null;
      const ok = obj?.ok === true;
      const errorText = typeof obj?.error === "string" ? obj.error : null;

      if (!res.ok || !ok) {
        setInsertReport("Finalize failed");
        setRightText(
          `Finalize failed.\n\n${errorText ?? `Request failed (${res.status})`}\n\n${JSON.stringify(json ?? null, null, 2)}`,
        );
        return;
      }

      setInsertReport("Finalize OK");
      setRightText(`Finalize OK.\n\n${JSON.stringify(json ?? null, null, 2)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setInsertReport("Finalize failed");
      setRightText(`Finalize failed.\n\n${msg}`);
    } finally {
      setIsFinalizeBusy(false);
    }
  }, []);

  const insertTempWordsFromJson = useCallback(async () => {
    setIsInsertBusy(true);
    setInsertReport(null);
    try {
      const parsed = JSON.parse(promptText) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(
          "Input must be a JSON array of { base_form, meaning_fa, sentence_en, sentence_en_meaning_fa }",
        );
      }

      const allowedKeys = [
        "base_form",
        "meaning_fa",
        "sentence_en",
        "sentence_en_meaning_fa",
      ] as const;
      const allowedKeySet = new Set<string>(allowedKeys);
      const issues: string[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i] as unknown;
        if (!row || typeof row !== "object") {
          issues.push(`item[${i}]: must be an object`);
          continue;
        }
        const keys = Object.keys(row as Record<string, unknown>);
        const extra = keys.filter((k) => !allowedKeySet.has(k));
        const missing = allowedKeys.filter(
          (k) => !(k in (row as Record<string, unknown>)),
        );
        if (keys.length !== allowedKeys.length) {
          issues.push(
            `item[${i}]: must have exactly ${allowedKeys.length} fields`,
          );
        }
        if (extra.length)
          issues.push(`item[${i}]: extra field(s): ${extra.join(", ")}`);
        if (missing.length)
          issues.push(`item[${i}]: missing field(s): ${missing.join(", ")}`);
      }
      if (issues.length) {
        throw new Error(
          `Invalid items:\n${issues.slice(0, 20).join("\n")}${issues.length > 20 ? "\n..." : ""}`,
        );
      }

      const res = await fetch("/api/word-extraction/base/insert-tempwords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        inserted?: number;
        skippedExisting?: number;
        total?: number;
        results?: unknown;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      setInsertReport(
        `Inserted: ${json.inserted ?? 0} • Skipped (exists): ${json.skippedExisting ?? 0} • Total: ${json.total ?? 0}`,
      );
      setRightText(
        `Inserted: ${json.inserted ?? 0}\nSkipped (exists): ${json.skippedExisting ?? 0}\nTotal: ${json.total ?? 0}\n\n` +
          JSON.stringify(json.results ?? null, null, 2),
      );
    } catch (error) {
      setInsertReport("Insert failed");
      setRightText(
        `خطا در INSERT.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsInsertBusy(false);
    }
  }, [promptText]);

  const insertWordsFromSentenceJson = useCallback(async () => {
    setIsSentenceInsertBusy(true);
    setInsertReport(null);
    try {
      const parsed = parseJsonArrayFromText(promptText);
      const res = await fetch("/api/word-extraction/ex-from-sentences/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        totalRows?: number;
        totalItems?: number;
        sentencesUpserted?: number;
        inserted?: number;
        skippedExisting?: number;
        results?: unknown;
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Request failed (${res.status})`);
      }

      setInsertReport(
        `Sentences: ${json.sentencesUpserted ?? 0} • Inserted: ${json.inserted ?? 0} • Skipped (exists): ${json.skippedExisting ?? 0} • Items: ${json.totalItems ?? 0}`,
      );
      setRightText(
        `Sentences upserted: ${json.sentencesUpserted ?? 0}\nInserted: ${json.inserted ?? 0}\nSkipped (exists): ${json.skippedExisting ?? 0}\nRows: ${json.totalRows ?? 0}\nItems: ${json.totalItems ?? 0}\n\n` +
          JSON.stringify(json.results ?? null, null, 2),
      );
    } catch (error) {
      setInsertReport("Sentence insert failed");
      setRightText(
        `خطا در INSERT از جملات.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSentenceInsertBusy(false);
    }
  }, [parseJsonArrayFromText, promptText]);

  return (
    <div className="grid gap-8">
      <PageHeader
        title="New Word Intake"
        subtitle="Clean raw words and meanings, generate example sentences, and create new vocabulary records."
        titleAccessory={(
          <Link
            href="/words/extraction"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-card"
          >
            Extraction Home
          </Link>
        )}
      />

      <div className="grid gap-6 rounded-2xl border border-card bg-gradient-to-br from-card to-background p-6 shadow-elevated">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">
                Prompt (left)
              </div>
              {baseMeta.rules ? (
                <div className="rounded-full border border-card bg-background px-3 py-1 text-xs text-muted">
                  {baseMeta.rules.filename} (V{baseMeta.rules.version})
                </div>
              ) : null}
            </div>
            <textarea
              dir="ltr"
              className="min-h-[360px] w-full resize-y rounded-2xl border border-card bg-background p-4 text-sm text-foreground outline-none ring-0 placeholder:text-muted focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary),transparent_70%)]"
              placeholder="Prompt text goes here…"
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-semibold text-red-600">
                Guide / Output (right)
              </div>
              {baseMeta.guide ? (
                <div className="rounded-full border border-card bg-background px-3 py-1 text-xs text-muted">
                  {baseMeta.guide.filename} (V{baseMeta.guide.version})
                </div>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={rightDir === "rtl"}
                onChange={(event) =>
                  setRightDir(event.target.checked ? "rtl" : "ltr")
                }
                className="h-4 w-4 rounded border border-card bg-background accent-[var(--primary)]"
              />
              RTL (Right-to-left)
            </label>
            {insertReport ? (
              <div className="rounded-xl border border-card bg-background px-3 py-2 text-xs text-muted">
                {insertReport}
              </div>
            ) : null}
            <textarea
              dir={rightDir}
              className="min-h-[360px] w-full resize-y rounded-2xl border border-card bg-background p-4 text-sm text-red-600 outline-none ring-0 placeholder:text-muted focus:border-red-500 focus:ring-2 focus:ring-red-200"
              placeholder="Output will appear here…"
              value={rightText}
              onChange={(event) => setRightText(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-3 rounded-2xl border border-card bg-background/60 p-4 backdrop-blur">
          <div className="text-xs font-semibold tracking-wide text-muted">
            TOOLS
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-green-700 to-emerald-600 text-white`}
              onClick={copyPromptToClipboard}
              disabled={isClipboardBusy}
            >
              {isClipboardBusy ? "WORKING..." : "COPY TO CLIPBOARD"}
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-green-700 to-emerald-600 text-white`}
              onClick={pastePromptFromClipboard}
              disabled={isClipboardBusy}
            >
              {isClipboardBusy ? "WORKING..." : "PASTE"}
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-slate-700 to-slate-600 text-white`}
              onClick={openHelpModal}
              disabled={isHelpModalLoading}
            >
              {isHelpModalLoading ? "LOADING..." : "HELP"}
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-violet-700 to-indigo-600 text-white`}
              onClick={openPlainSentencePromptModal}
              disabled={isSentenceExtractModalLoading}
            >
              {isSentenceExtractModalLoading
                ? "LOADING..."
                : "PROMPT FROM SENTENCES"}
            </button>
            <button
              type="button"
              className={`${buttonBase} w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white`}
              onClick={finalize}
              disabled={isFinalizeBusy}
            >
              {isFinalizeBusy ? "FINALIZING..." : "FINALIZE"}
            </button>
          </div>
        </div>
        <div className="grid gap-3 rounded-2xl border border-card bg-background/60 p-4 backdrop-blur lg:grid-cols-3">
          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              فاز ۱ استخراج از کلمات
            </div>
            <div className="text-xs opacity-70">
              فقط برای کلمات است؛ یعنی مرتب‌سازی و استخراج داده‌ی پایه‌ی کلمات،
              نه پردازش‌های بعدی.
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
                onClick={openBasePromptModal}
                disabled={isBaseModalLoading}
              >
                1.1 PROMPT FOR: CONVERT WORDS TO GET BASEDATA FROM AI
              </button>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
                onClick={insertTempWordsFromJson}
                disabled={isInsertBusy}
              >
                {isInsertBusy ? "INSERTING..." : "1.2 INSERT BASE FORTEMPWORDS"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              فاز ۱ استخراج از جملات
            </div>
            <div className="grid gap-3">
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  className={`${buttonBase} flex-1 bg-gradient-to-r from-violet-700 to-indigo-600 text-white`}
                  onClick={openSentenceExtractPromptModal}
                  disabled={isSentenceExtractModalLoading}
                >
                  1.S.1 PROMPT FOR: EXTRACT FROM SENTENCES
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={sentenceExtractTailLimit}
                  onChange={(event) =>
                    setSentenceExtractTailLimit(event.target.value)
                  }
                  className="h-11 w-20 rounded-xl border border-card bg-background px-3 text-xs font-semibold text-foreground shadow-elevated outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary),transparent_70%)]"
                  aria-label="Count (missing sentence note rows)"
                  title="تعداد جمله‌های DB که در نوت‌های جمله Anki وجود ندارند"
                />
              </div>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-violet-700 to-indigo-600 text-white`}
                onClick={insertWordsFromSentenceJson}
                disabled={isSentenceInsertBusy}
              >
                {isSentenceInsertBusy
                  ? "INSERTING..."
                  : "1.S.2 INSERT BASE FOR TEMPWORDS FROM SENTENCES"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              PHASE 2
            </div>
            <div className="grid gap-3">
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  className={`${buttonBase} flex-1 bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
                  onClick={openPhoneticPromptModal}
                  disabled={isPhoneticModalLoading}
                >
                  2.1 PROMPT FOR: EXTRACT MEANING_FA_IPA
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={meaningFaIpaTailLimit}
                  onChange={(event) =>
                    setMeaningFaIpaTailLimit(event.target.value)
                  }
                  className="h-11 w-20 rounded-xl border border-card bg-background px-3 text-xs font-semibold text-foreground shadow-elevated outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary),transparent_70%)]"
                  aria-label="Count (meaning_fa_IPA tail rows)"
                  title="تعداد رکوردهای انتهای پرامپت (meaning_fa_IPA)"
                />
              </div>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
                onClick={openMeaningIpaUpdateModal}
              >
                2.2 APPLY MEANING_FA_IPA (per row)
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-card bg-background/60 p-4 backdrop-blur lg:grid-cols-2">
          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              PHASE 3 — PHONETIC_US + IMAGEABILITY + LEARNING_DEPTH + PRODUCTIVE_TARGET +
              POS + OTHER_MEANINGS_FA + CONCEPT_EXPLAINED_FA
            </div>
            <div className="grid gap-3">
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  className={`${buttonBase} flex-1 bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
                  onClick={openBase2PromptModal}
                  disabled={isBase2ModalLoading}
                >
                  3.1 PROMPT FOR: PHONETIC_US + IMAGEABILITY + LEARNING_DEPTH + PRODUCTIVE_TARGET +
                  POS + OTHER_MEANINGS_FA + CONCEPT_EXPLAINED_FA
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={phase3TailLimit}
                  onChange={(event) => setPhase3TailLimit(event.target.value)}
                  className="h-11 w-20 rounded-xl border border-card bg-background px-3 text-xs font-semibold text-foreground shadow-elevated outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary),transparent_70%)]"
                  aria-label="Count (phase 3 tail rows)"
                  title="تعداد رکوردهای انتهای پرامپت (Phase 3)"
                />
              </div>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
                onClick={applyBase2FromJson}
                disabled={isBase2ApplyBusy}
              >
                {isBase2ApplyBusy ? "UPDATING..." : "3.2 APPLY PHASE 3 (ALL)"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              HELPER (PHASE 4 AREA)
            </div>
            <div className="grid gap-3">
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  className={`${buttonBase} flex-1 bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
                  onClick={openPhase4PromptModal}
                  disabled={isPhase4PromptModalLoading}
                >
                  4.1 PROMPT FILES + MISSING (SELECT FIELD)
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  value={phase4TailLimit}
                  onChange={(event) => setPhase4TailLimit(event.target.value)}
                  className="h-11 w-20 rounded-xl border border-card bg-background px-3 text-xs font-semibold text-foreground shadow-elevated outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary),transparent_70%)]"
                  aria-label="Count (phase 4 helper rows)"
                  title="تعداد رکوردهای Helper (Phase 4)"
                />
              </div>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
                onClick={applyPhase4FromJson}
                disabled={isPhase4ApplyBusy}
              >
                {isPhase4ApplyBusy ? "UPDATING..." : "4.2 APPLY (HELPER)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isBaseModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-5xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Base Prompt Files</div>
                <div className="mt-1 text-xs opacity-70">
                  {baseModalItems.length} file(s) loaded in order
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBaseModalOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {baseModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {baseModalError}
              </div>
            ) : null}

            {isBaseModalLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs opacity-70">
                    {baseModalItems.length} file(s)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openPromptPathModal("Base Prompt Files", baseModalItems)
                      }
                      className="rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      File paths
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const combined = baseModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        void navigator.clipboard
                          .writeText(combined)
                          .then(() => {
                            setBaseModalCopied(true);
                            window.setTimeout(
                              () => setBaseModalCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        baseModalCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                    >
                      {baseModalCopied ? "Copied" : "Copy all"}
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={baseModalItems
                    .map((item) => item.text.trim())
                    .join("\n\n")}
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isSentenceExtractModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-5xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  {sentenceExtractModalKind === "missing"
                    ? "Sentence Extraction Prompt"
                    : "Prompt From Sentences"}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {sentenceExtractModalKind === "missing"
                    ? `Prompt file + ${sentenceExtractModalTailCount} missing sentence rows (limit ${sentenceExtractModalTailLimitApplied})`
                    : "Prompt file only"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSentenceExtractModalOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {sentenceExtractModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {sentenceExtractModalError}
              </div>
            ) : null}

            {isSentenceExtractModalLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs opacity-70">
                    {sentenceExtractModalItems.length} file(s)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openPromptPathModal(
                          sentenceExtractModalKind === "missing"
                            ? "Sentence Extraction Prompt"
                            : "Prompt From Sentences",
                          sentenceExtractModalItems,
                        )
                      }
                      className="rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      File paths
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const combined = sentenceExtractModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        void navigator.clipboard
                          .writeText(combined)
                          .then(() => {
                            setSentenceExtractModalPromptCopied(true);
                            setSentenceExtractModalCopied(false);
                            setSentenceExtractModalDataCopied(false);
                            window.setTimeout(
                              () => setSentenceExtractModalPromptCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        sentenceExtractModalPromptCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                    >
                      {sentenceExtractModalPromptCopied
                        ? "Copied"
                        : "Copy prompt"}
                    </button>
                    {sentenceExtractModalKind === "missing" ? (
                      <button
                        type="button"
                        disabled={!sentenceExtractModalTailJson}
                        onClick={() => {
                          if (!sentenceExtractModalTailJson) return;
                          void navigator.clipboard
                            .writeText(sentenceExtractModalTailJson)
                            .then(() => {
                              setSentenceExtractModalDataCopied(true);
                              setSentenceExtractModalCopied(false);
                              setSentenceExtractModalPromptCopied(false);
                              window.setTimeout(
                                () => setSentenceExtractModalDataCopied(false),
                                1200,
                              );
                            });
                        }}
                        className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5 ${
                          sentenceExtractModalDataCopied
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : ""
                        }`}
                        title="Copies JSON array only"
                      >
                        {sentenceExtractModalDataCopied
                          ? "Copied"
                          : "Copy data"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const combined = sentenceExtractModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        const tail = sentenceExtractModalTailJson
                          ? `\n\n${sentenceExtractModalTailJson}`
                          : "";
                        void navigator.clipboard
                          .writeText(`${combined}${tail}`)
                          .then(() => {
                            setSentenceExtractModalCopied(true);
                            setSentenceExtractModalPromptCopied(false);
                            setSentenceExtractModalDataCopied(false);
                            window.setTimeout(
                              () => setSentenceExtractModalCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        sentenceExtractModalCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title={
                        sentenceExtractModalKind === "missing"
                          ? "Copies prompt + JSON array"
                          : "Copies prompt file"
                      }
                    >
                      {sentenceExtractModalCopied ? "Copied" : "Copy all"}
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={`${sentenceExtractModalItems
                    .map((item) => item.text.trim())
                    .join(
                      "\n\n",
                    )}${sentenceExtractModalTailJson ? `\n\n${sentenceExtractModalTailJson}` : ""}`}
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isPhoneticModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-5xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  meaning_fa_IPA Prompt
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Prompt files + {phoneticModalTailCount} missing rows (limit{" "}
                  {phoneticModalTailLimitApplied})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhoneticModalOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {phoneticModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {phoneticModalError}
              </div>
            ) : null}

            {isPhoneticModalLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs opacity-70">
                    {phoneticModalItems.length} file(s)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openPromptPathModal(
                          "meaning_fa_IPA Prompt",
                          phoneticModalItems,
                        )
                      }
                      className="rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      File paths
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const combined = phoneticModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        void navigator.clipboard
                          .writeText(combined)
                          .then(() => {
                            setPhoneticModalPromptCopied(true);
                            setPhoneticModalCopied(false);
                            setPhoneticModalDataCopied(false);
                            window.setTimeout(
                              () => setPhoneticModalPromptCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        phoneticModalPromptCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title="Copies prompt files only (no JSON array)"
                    >
                      {phoneticModalPromptCopied ? "Copied" : "Copy prompt"}
                    </button>
                    <button
                      type="button"
                      disabled={!phoneticModalTailJson}
                      onClick={() => {
                        if (!phoneticModalTailJson) return;
                        void navigator.clipboard
                          .writeText(phoneticModalTailJson)
                          .then(() => {
                            setPhoneticModalDataCopied(true);
                            setPhoneticModalCopied(false);
                            setPhoneticModalPromptCopied(false);
                            window.setTimeout(
                              () => setPhoneticModalDataCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5 ${
                        phoneticModalDataCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title="Copies JSON array only"
                    >
                      {phoneticModalDataCopied ? "Copied" : "Copy data"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const combined = phoneticModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        const tail = phoneticModalTailJson
                          ? `\n\n${phoneticModalTailJson}`
                          : "";
                        void navigator.clipboard
                          .writeText(`${combined}${tail}`)
                          .then(() => {
                            setPhoneticModalCopied(true);
                            setPhoneticModalPromptCopied(false);
                            setPhoneticModalDataCopied(false);
                            window.setTimeout(
                              () => setPhoneticModalCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        phoneticModalCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title="Copies prompt + JSON array"
                    >
                      {phoneticModalCopied ? "Copied" : "Copy all"}
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={`${phoneticModalItems
                    .map((item) => item.text.trim())
                    .join(
                      "\n\n",
                    )}${phoneticModalTailJson ? `\n\n${phoneticModalTailJson}` : ""}`}
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isMeaningIpaModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-6xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  Review and confirm meaning_fa_IPA
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Paste JSON in Prompt (left), review the values here, then use Update &amp; confirm. Every successful update sets meaning_fa_IPA_confirmed=true.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveAllMeaningIpa()}
                  disabled={
                    isMeaningIpaBulkSaving || meaningIpaRows.length === 0
                  }
                  className="rounded border px-3 py-1 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  title="Updates and human-confirms meaning_fa_IPA for all loaded rows"
                >
                  {isMeaningIpaBulkSaving ? "Updating and confirming all..." : "Update & confirm all"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMeaningIpaModalOpen(false)}
                  className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>

            {meaningIpaModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {meaningIpaModalError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-card bg-card p-3 shadow-elevated">
              <div className="text-sm font-semibold text-foreground">
                Special characters
              </div>
              {["æ", "x", "ɪ", "ɜ", "ə", "ʊ", "ʌ", "ʔ", "j"].map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMeaningIpaSpecialChar(ch);
                  }}
                  className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
                  title="Click an input, then click a character"
                >
                  {ch}
                </button>
              ))}
              <div className="ml-auto text-xs text-muted">
                Click an input, then click a character.
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      id
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      base_form
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      meaning_fa
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      meaning_fa_IPA (DB)
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      confirmed
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      meaning_fa_IPA (input/edit)
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">
                      action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {meaningIpaRows.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        {r.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {r.base_form}
                      </td>
                      <td
                        className="max-w-[320px] truncate px-3 py-2"
                        title={r.meaning_fa}
                      >
                        {r.meaning_fa}
                      </td>
                      <td
                        className="max-w-[260px] truncate px-3 py-2 font-mono"
                        title={r.dbMeaningIpa}
                      >
                        {r.dbMeaningIpa || "—"}
                      </td>
                      <td className={r.dbMeaningIpaConfirmed ? "px-3 py-2 font-semibold text-emerald-700" : "px-3 py-2 font-semibold text-amber-700"}>
                        {r.dbMeaningIpaConfirmed ? "True" : "False"}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.inputMeaningIpa}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMeaningIpaRows((cur) =>
                              cur.map((x) =>
                                x.id === r.id
                                  ? { ...x, inputMeaningIpa: v, dbMeaningIpaConfirmed: false, saved: false }
                                  : x,
                              ),
                            );
                          }}
                          onFocus={(e) => {
                            lastFocusedMeaningIpaInputRef.current =
                              e.currentTarget;
                            lastFocusedMeaningIpaIdRef.current = r.id;
                          }}
                          className="h-9 w-[320px] rounded border border-card bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        {r.saveError ? (
                          <div
                            className="mt-1 max-w-[360px] truncate text-[11px] text-red-600"
                            title={r.saveError}
                          >
                            {r.saveError}
                          </div>
                        ) : null}
                        {r.saved ? (
                          <div className="mt-1 text-[11px] text-green-700">
                            Confirmed
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void saveMeaningIpa(r.id, r.inputMeaningIpa)
                            }
                            disabled={r.saving || r.deleting}
                            className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                            title="Updates and human-confirms meaning_fa_IPA for this row"
                          >
                            {r.saving ? "Saving…" : "Update & confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void deleteMeaningIpaRow(r.id, r.base_form)
                            }
                            disabled={r.saving || r.deleting}
                            className="rounded border border-red-500/30 bg-red-600/10 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-600/15 disabled:opacity-50 dark:text-red-300"
                            title="Delete this word from the database"
                          >
                            {r.deleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {meaningIpaRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-sm opacity-70"
                      >
                        No rows loaded.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {isBase2ModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-5xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  Phase 3 — phonetic_us
                </div>
                <div className="mt-1 text-xs opacity-70">
                  مبنای استخراج: فقط رکوردهایی واکشی می‌شوند که
                  <span className="font-mono"> phonetic_us </span>
                  آن‌ها
                  <span className="font-mono"> NULL </span>
                  یا خالی باشد.
                  <br />
                  کل رکوردهای دارای شرایط:{" "}
                  {typeof base2ModalTotalCount === "number"
                    ? base2ModalTotalCount
                    : "—"}{" "}
                  — واکشی‌شده: {base2ModalTailCount} (limit{" "}
                  {base2ModalTailLimitApplied})
                  (id/base_form/meaning_fa/sentence_en/sentence_en_meaning_fa)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBase2ModalOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {base2ModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {base2ModalError}
              </div>
            ) : null}

            {isBase2ModalLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs opacity-70">
                    {base2ModalItems.length} file(s)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        openPromptPathModal("Phase 3 Prompt", base2ModalItems)
                      }
                      className="rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      File paths
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const combined = base2ModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        void navigator.clipboard
                          .writeText(combined)
                          .then(() => {
                            setBase2ModalPromptCopied(true);
                            setBase2ModalCopied(false);
                            setBase2ModalDataCopied(false);
                            window.setTimeout(
                              () => setBase2ModalPromptCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        base2ModalPromptCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title="Copies prompt files only (no JSON array)"
                    >
                      {base2ModalPromptCopied ? "Copied" : "Copy prompt"}
                    </button>
                    <button
                      type="button"
                      disabled={!base2ModalTailJson}
                      onClick={() => {
                        if (!base2ModalTailJson) return;
                        void navigator.clipboard
                          .writeText(base2ModalTailJson)
                          .then(() => {
                            setBase2ModalDataCopied(true);
                            setBase2ModalCopied(false);
                            setBase2ModalPromptCopied(false);
                            window.setTimeout(
                              () => setBase2ModalDataCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5 ${
                        base2ModalDataCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title="Copies JSON array only"
                    >
                      {base2ModalDataCopied ? "Copied" : "Copy data"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const combined = base2ModalItems
                          .map((item) => item.text.trim())
                          .join("\n\n");
                        const tail = base2ModalTailJson
                          ? `\n\n${base2ModalTailJson}`
                          : "";
                        void navigator.clipboard
                          .writeText(`${combined}${tail}`)
                          .then(() => {
                            setBase2ModalCopied(true);
                            setBase2ModalPromptCopied(false);
                            setBase2ModalDataCopied(false);
                            window.setTimeout(
                              () => setBase2ModalCopied(false),
                              1200,
                            );
                          });
                      }}
                      className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                        base2ModalCopied
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : ""
                      }`}
                      title="Copies prompt + JSON array"
                    >
                      {base2ModalCopied ? "Copied" : "Copy all"}
                    </button>
                  </div>
                </div>
                <textarea
                  readOnly
                  value={`${base2ModalItems
                    .map((item) => item.text.trim())
                    .join(
                      "\n\n",
                    )}${base2ModalTailJson ? `\n\n${base2ModalTailJson}` : ""}`}
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      {isPhase4PromptModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-5xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  Helper — prompt files + missing rows
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Select a field to load the chosen number of missing rows;
                  check files to include in the shown prompt text.
                </div>
                {phase4MissingReport ? (
                  <div className="mt-2 truncate text-xs opacity-70">
                    {phase4MissingReport}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setIsPhase4PromptModalOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {phase4PromptModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {phase4PromptModalError}
              </div>
            ) : null}

            {isPhase4PromptModalLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="min-h-0 flex flex-[0_0_30%] flex-col overflow-hidden rounded-2xl border bg-background/50">
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="text-[11px] font-semibold tracking-wide text-muted">
                      FIELDS / FILES
                    </div>
                    <div className="text-[11px] opacity-70">
                      {helperSpecs.filter((s) => phase4Checked[s.id]).length}{" "}
                      checked
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto p-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {helperSpecs.map((spec) => {
                        const checked = Boolean(phase4Checked[spec.id]);
                        const isActive = spec.id === phase4ActiveId;
                        const shortName = (() => {
                          const parts = spec.path.split("/");
                          const file = parts.at(-1) ?? spec.path;
                          const parent = parts.at(-2);
                          return parent ? `${parent}/${file}` : file;
                        })();
                        return (
                          <div
                            key={spec.id}
                            className={`group flex cursor-pointer items-start gap-2 rounded-xl border px-2 py-2 text-[11px] transition hover:bg-black/5 dark:hover:bg-white/5 ${
                              isActive
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-transparent"
                            }`}
                            onClick={() => {
                              setPhase4ActiveId(spec.id);
                              if (!checked) {
                                setPhase4Checked((cur) => ({
                                  ...cur,
                                  [spec.id]: true,
                                }));
                              }
                              if (spec.fieldKey)
                                void loadPhase4Missing(spec.fieldKey);
                            }}
                            title={spec.path}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setPhase4Checked((cur) => ({
                                  ...cur,
                                  [spec.id]: next,
                                }));
                                setPhase4ActiveId(spec.id);
                                if (next && spec.fieldKey)
                                  void loadPhase4Missing(spec.fieldKey);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`${isActive ? "font-semibold" : ""}`}
                                >
                                  {spec.label}
                                </span>
                                <span className="opacity-60">
                                  {spec.fieldKey ? spec.fieldKey : "base"}
                                </span>
                              </div>
                              <div className="truncate text-[10px] opacity-60">
                                <span className="hidden group-hover:inline">
                                  {spec.path}
                                </span>
                                <span className="group-hover:hidden">
                                  {shortName}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="text-xs opacity-70">
                      {isPhase4MissingLoading
                        ? "Loading missing rows…"
                        : "Prompt + missing rows"}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openPromptPathModal(
                            "Helper Prompt Files",
                            phase4PromptModalItems,
                          )
                        }
                        className="rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        File paths
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(buildHelperPromptText())
                            .then(() => {
                              setPhase4PromptModalCopied(true);
                              window.setTimeout(
                                () => setPhase4PromptModalCopied(false),
                                1200,
                              );
                            });
                        }}
                        className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                          phase4PromptModalCopied
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : ""
                        }`}
                      >
                        {phase4PromptModalCopied ? "Copied" : "Copy all"}
                      </button>
                    </div>
                  </div>
                  <textarea
                    readOnly
                    value={buildHelperPromptText()}
                    className="h-full w-full resize-none bg-transparent p-3 font-mono text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {promptPathModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex w-full max-w-3xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  {promptPathModal.title} — file paths
                </div>
                <div className="mt-1 text-xs opacity-70">
                  {promptPathModal.paths.length} prompt file(s)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPromptPathModal(null)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="max-h-[55vh] overflow-auto rounded border bg-background/50">
              {promptPathModal.paths.length ? (
                <ol className="grid gap-0">
                  {promptPathModal.paths.map((path, index) => (
                    <li
                      key={`${path}-${index}`}
                      className="border-b px-3 py-2 font-mono text-xs last:border-b-0"
                    >
                      {path}
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="px-3 py-6 text-center text-sm opacity-70">
                  No prompt file paths loaded.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={promptPathModal.paths.length === 0}
                onClick={() => {
                  void navigator.clipboard
                    .writeText(promptPathModal.paths.join("\n"))
                    .then(() => {
                      setPromptPathModalCopied(true);
                      window.setTimeout(
                        () => setPromptPathModalCopied(false),
                        1200,
                      );
                    });
                }}
                className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5 ${
                  promptPathModalCopied
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : ""
                }`}
              >
                {promptPathModalCopied ? "Copied" : "Copy paths"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isHelpModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-4xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">
                  Word Extraction — help
                </div>
                <div className="mt-1 text-xs opacity-70">
                  src/helps/wordExtraction.md
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void saveHelpModal()}
                  disabled={
                    isHelpModalLoading ||
                    isHelpModalSaving ||
                    helpModalText === helpModalSavedText
                  }
                  className={`rounded border px-3 py-1 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5 ${
                    helpModalSaveOk
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : ""
                  }`}
                  title="Save changes to src/helps/wordExtraction.md"
                >
                  {isHelpModalSaving
                    ? "Saving…"
                    : helpModalSaveOk
                      ? "Saved"
                      : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsHelpModalOpen(false)}
                  className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>
            </div>

            {helpModalError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {helpModalError}
              </div>
            ) : null}

            {helpModalSaveError ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {helpModalSaveError}
              </div>
            ) : null}

            {isHelpModalLoading ? (
              <div className="text-sm opacity-70">Loading…</div>
            ) : (
              <textarea
                dir="rtl"
                value={helpModalText}
                onChange={(e) => setHelpModalText(e.target.value)}
                className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 text-right font-mono text-xs"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
