 "use client";

import { PageHeader } from "@/components/page-header";
import { useCallback, useRef, useState } from "react";

const buttonBase =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-semibold tracking-wide shadow-elevated transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.18)] hover:brightness-105 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-elevated";

export default function WordExtractionPage() {
  const [promptText, setPromptText] = useState(
    [
      "ROLE: Final Meaning Extraction & Sense Generator",
      "",
      "Your task:",
      "Perform the full internal pipeline:",
      "1) normalization of noisy input",
      "2) base_form extraction",
      "3) extraction of meanings_fa and sentence_en",
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
    { path: string; text: string }[]
  >([]);
  const [baseModalCopied, setBaseModalCopied] = useState(false);
  const [isPhoneticModalOpen, setIsPhoneticModalOpen] = useState(false);
  const [isPhoneticModalLoading, setIsPhoneticModalLoading] = useState(false);
  const [phoneticModalError, setPhoneticModalError] = useState<string | null>(
    null,
  );
  const [phoneticModalItems, setPhoneticModalItems] = useState<
    { path: string; text: string }[]
  >([]);
  const [phoneticModalTailJson, setPhoneticModalTailJson] = useState<string>("");
  const [phoneticModalCopied, setPhoneticModalCopied] = useState(false);
  const [isMeaningIpaModalOpen, setIsMeaningIpaModalOpen] = useState(false);
  const [meaningIpaModalError, setMeaningIpaModalError] = useState<string | null>(null);
  const [meaningIpaRows, setMeaningIpaRows] = useState<
    Array<{
      id: number;
      base_form: string;
      meaning_fa: string;
      dbMeaningIpa: string;
      dbMeaningIpaNormalized: string;
      inputMeaningIpa: string;
      saving: boolean;
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

    const start = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
    const end = typeof el.selectionEnd === "number" ? el.selectionEnd : el.value.length;
    const nextValue = `${el.value.slice(0, start)}${ch}${el.value.slice(end)}`;

    setMeaningIpaRows((cur) =>
      cur.map((r) => (r.id === id ? { ...r, inputMeaningIpa: nextValue, saved: false } : r)),
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

  const openPhoneticPromptModal = useCallback(async () => {
    setIsPhoneticModalOpen(true);
    setIsPhoneticModalLoading(true);
    setPhoneticModalError(null);
    setPhoneticModalTailJson("");
    setPhoneticModalCopied(false);
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

      const missingRes = await fetch(
        "/api/word-extraction/phonetic-us/missing-meaning-fa-ipa",
        { method: "GET" }
      );
      const missingJson = (await missingRes.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: unknown }
        | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing meaning_fa_IPA rows (${missingRes.status})`
        );
      }
      setPhoneticModalTailJson(JSON.stringify(missingJson.items ?? [], null, 2));
    } catch (error) {
      setPhoneticModalError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPhoneticModalLoading(false);
    }
  }, []);

  const openMeaningIpaUpdateModal = useCallback(async () => {
    setMeaningIpaModalError(null);
    setIsMeaningIpaModalOpen(true);
    setMeaningIpaRows([]);

    try {
      const parsed = JSON.parse(promptText) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("Input must be a JSON array: [{ id, meaning_fa_IPA }]");
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

        const id = typeof obj.id === "number" && Number.isFinite(obj.id) ? Math.trunc(obj.id) : null;
        const meaning = typeof obj.meaning_fa_IPA === "string" ? obj.meaning_fa_IPA.trim() : "";
        if (!id || id <= 0) throw new Error(`item[${i}].id must be a positive number`);
        if (!meaning) throw new Error(`item[${i}].meaning_fa_IPA must be a non-empty string`);
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
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            items?: Array<{
              id: number;
              base_form: string;
              meaning_fa: string;
              meaning_fa_IPA: string;
              meaning_fa_IPA_normalized: string;
            }>;
          }
        | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

      const items = Array.isArray(json.items) ? json.items : [];
      const byId = new Map(items.map((it) => [it.id, it]));

      const rows = inputPairs.map((p) => {
        const db = byId.get(p.id);
        if (!db) {
          throw new Error(`Word not found in DB for id=${p.id}`);
        }
        return {
          id: db.id,
          base_form: db.base_form,
          meaning_fa: db.meaning_fa,
          dbMeaningIpa: db.meaning_fa_IPA,
          dbMeaningIpaNormalized: db.meaning_fa_IPA_normalized,
          inputMeaningIpa: p.meaning_fa_IPA,
          saving: false,
          saveError: null,
          saved: false,
        };
      });

      setMeaningIpaRows(rows);
    } catch (e) {
      setMeaningIpaModalError(e instanceof Error ? e.message : String(e));
    }
  }, [promptText]);

  const [isBase2ModalOpen, setIsBase2ModalOpen] = useState(false);
  const [isBase2ModalLoading, setIsBase2ModalLoading] = useState(false);
  const [base2ModalError, setBase2ModalError] = useState<string | null>(null);
  const [base2ModalItems, setBase2ModalItems] = useState<{ path: string; text: string }[]>([]);
  const [base2ModalTailJson, setBase2ModalTailJson] = useState<string>("");
  const [base2ModalCopied, setBase2ModalCopied] = useState(false);
  const [isBase2ApplyBusy, setIsBase2ApplyBusy] = useState(false);
  const [isPhase4ApplyBusy, setIsPhase4ApplyBusy] = useState(false);
  const [isPhase4PromptModalOpen, setIsPhase4PromptModalOpen] = useState(false);
  const [isPhase4PromptModalLoading, setIsPhase4PromptModalLoading] = useState(false);
  const [phase4PromptModalError, setPhase4PromptModalError] = useState<string | null>(null);
  const [phase4PromptModalItems, setPhase4PromptModalItems] = useState<{ path: string; text: string }[]>([]);
  const [phase4PromptModalTailJson, setPhase4PromptModalTailJson] = useState<string>("");
  const [phase4PromptModalCopied, setPhase4PromptModalCopied] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isHelpModalLoading, setIsHelpModalLoading] = useState(false);
  const [isHelpModalSaving, setIsHelpModalSaving] = useState(false);
  const [helpModalError, setHelpModalError] = useState<string | null>(null);
  const [helpModalText, setHelpModalText] = useState("");
  const [helpModalSavedText, setHelpModalSavedText] = useState("");
  const [helpModalSaveError, setHelpModalSaveError] = useState<string | null>(null);
  const [helpModalSaveOk, setHelpModalSaveOk] = useState(false);

  const openBase2PromptModal = useCallback(async () => {
    setIsBase2ModalOpen(true);
    setIsBase2ModalLoading(true);
    setBase2ModalError(null);
    setBase2ModalTailJson("");
    setBase2ModalCopied(false);
    try {
      const paths = [
        "src/prompts/word-extraction/base/inputOutRulseV1 .md",
        "src/prompts/word-extraction/phonetic_us/rulseV1.md",
        "src/prompts/word-extraction/imageability/rulseV1.md",
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
      setBase2ModalItems(results);

      const missingRes = await fetch(
        "/api/word-extraction/base2/missing-phonetic-imageability",
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: unknown }
        | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing phonetic/imageability rows (${missingRes.status})`,
        );
      }
      setBase2ModalTailJson(JSON.stringify(missingJson.items ?? [], null, 2));
    } catch (error) {
      setBase2ModalError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBase2ModalLoading(false);
    }
  }, []);

  const openPhase4PromptModal = useCallback(async () => {
    setIsPhase4PromptModalOpen(true);
    setIsPhase4PromptModalLoading(true);
    setPhase4PromptModalError(null);
    setPhase4PromptModalTailJson("");
    setPhase4PromptModalCopied(false);
    try {
      const paths = [
        "src/prompts/word-extraction/base/inputOutRulseV1 .md",
        "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
        "src/prompts/word-extraction/pos/rulseV1.md",
        "src/prompts/word-extraction/other_meanings_fa/rulseV1.md",
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
      setPhase4PromptModalItems(results);

      const missingRes = await fetch(
        "/api/word-extraction/phase4/missing-sentence-en-meaning-fa",
        { method: "GET" },
      );
      const missingJson = (await missingRes.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: unknown }
        | null;
      if (!missingRes.ok || !missingJson?.ok) {
        throw new Error(
          missingJson?.error ??
            `Failed to load missing sentence_en_meaning_fa rows (${missingRes.status})`,
        );
      }
      setPhase4PromptModalTailJson(JSON.stringify(missingJson.items ?? [], null, 2));
    } catch (error) {
      setPhase4PromptModalError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPhase4PromptModalLoading(false);
    }
  }, []);

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
        body: JSON.stringify({ path: "wordExtraction.md", text: helpModalText }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
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
          "Input must be a JSON array: [{ id, phonetic_us, imageability }]",
        );
      }

      const res = await fetch("/api/word-extraction/base2/update-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; total?: number; updated?: number; results?: unknown }
        | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

      const report = `Updated: ${json.updated ?? 0}/${json.total ?? 0}`;
      setInsertReport(report);
      setRightText(`${report}\n\n${JSON.stringify(json.results ?? null, null, 2)}`);
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
          "Input must be a JSON array: [{ id, sentence_en_meaning_fa, pos, other_meanings_fa }]",
        );
      }

      const res = await fetch("/api/word-extraction/phase4/update-bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; total?: number; updated?: number; results?: unknown }
        | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

      const report = `Updated: ${json.updated ?? 0}/${json.total ?? 0}`;
      setInsertReport(report);
      setRightText(`${report}\n\n${JSON.stringify(json.results ?? null, null, 2)}`);
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
        r.id === id ? { ...r, saving: true, saveError: null, saved: false } : r,
      ),
    );

    const value = valueRaw.trim();
    try {
      const res = await fetch("/api/word-extraction/meaning-fa-ipa/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, meaning_fa_IPA: value }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; item?: { meaning_fa_IPA: string; meaning_fa_IPA_normalized: string } }
        | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);

      setMeaningIpaRows((cur) =>
        cur.map((r) =>
          r.id === id
            ? {
                ...r,
                dbMeaningIpa: json.item?.meaning_fa_IPA ?? r.dbMeaningIpa,
                dbMeaningIpaNormalized: json.item?.meaning_fa_IPA_normalized ?? r.dbMeaningIpaNormalized,
                saving: false,
                saveError: null,
                saved: true,
              }
            : r,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMeaningIpaRows((cur) =>
        cur.map((r) => (r.id === id ? { ...r, saving: false, saveError: msg, saved: false } : r)),
      );
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
      const res = await fetch("/api/word-extraction/finalize", { method: "POST" });
      const json = (await res.json().catch(() => null)) as unknown;
      const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
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
          "Input must be a JSON array of { base_form, meaning_fa, sentence_en }",
        );
      }

      const allowedKeys = ["base_form", "meaning_fa", "sentence_en"] as const;
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
        const missing = allowedKeys.filter((k) => !(k in (row as Record<string, unknown>)));
        if (keys.length !== allowedKeys.length) {
          issues.push(`item[${i}]: must have exactly ${allowedKeys.length} fields`);
        }
        if (extra.length) issues.push(`item[${i}]: extra field(s): ${extra.join(", ")}`);
        if (missing.length) issues.push(`item[${i}]: missing field(s): ${missing.join(", ")}`);
      }
      if (issues.length) {
        throw new Error(`Invalid items:\n${issues.slice(0, 20).join("\n")}${issues.length > 20 ? "\n..." : ""}`);
      }

      const res = await fetch("/api/word-extraction/base/insert-tempwords", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            inserted?: number;
            skippedExisting?: number;
            total?: number;
            results?: unknown;
          }
        | null;
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

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Word Extraction"
        subtitle="پرامپت و راهنما را از فایل‌ها می‌خواند (فعلاً فقط base)."
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
                onChange={(event) => setRightDir(event.target.checked ? "rtl" : "ltr")}
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

        <div className="grid gap-3 rounded-2xl border border-card bg-background/60 p-4 backdrop-blur lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              PHASE 1–2
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
              onClick={openPhoneticPromptModal}
              disabled={isPhoneticModalLoading}
            >
              2.1 PROMPT FOR: EXTRACT MEANING_FA_IPA
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
              onClick={insertTempWordsFromJson}
              disabled={isInsertBusy}
            >
              {isInsertBusy ? "INSERTING..." : "1.2 INSERT BASE FORTEMPWORDS"}
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
              onClick={openMeaningIpaUpdateModal}
            >
              2.2 APPLY MEANING_FA_IPA (per row)
            </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">
              TOOLS
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
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
            </div>
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

        <div className="grid gap-3 rounded-2xl border border-card bg-background/60 p-4 backdrop-blur lg:grid-cols-2">
          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">PHASE 3</div>
            <div className="grid gap-3">
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
                onClick={openBase2PromptModal}
                disabled={isBase2ModalLoading}
              >
                3.1 PROMPT FOR: PHONETIC_US + IMAGEABILITY
              </button>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
                onClick={applyBase2FromJson}
                disabled={isBase2ApplyBusy}
              >
                {isBase2ApplyBusy
                  ? "UPDATING..."
                  : "3.2 APPLY PHONETIC_US + IMAGEABILITY (ALL)"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-card bg-background/70 p-3">
            <div className="text-xs font-semibold tracking-wide text-muted">PHASE 4</div>
            <div className="grid gap-3">
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
                onClick={openPhase4PromptModal}
                disabled={isPhase4PromptModalLoading}
              >
                4.1 PROMPT FOR: SENTENCE_EN_MEANING_FA
              </button>
              <button
                type="button"
                className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
                onClick={applyPhase4FromJson}
                disabled={isPhase4ApplyBusy}
              >
                {isPhase4ApplyBusy ? "UPDATING..." : "4.2 APPLY SENTENCE_EN_MEANING_FA"}
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
                <div className="text-base font-semibold">
                  Base Prompt Files
                </div>
                <div className="mt-1 text-xs opacity-70">
                  3 files loaded in order
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
                  <button
                    type="button"
                    onClick={() => {
                      const combined = baseModalItems
                        .map((item) => item.text.trim())
                        .join("\n\n");
                      void navigator.clipboard.writeText(combined).then(() => {
                        setBaseModalCopied(true);
                        window.setTimeout(() => setBaseModalCopied(false), 1200);
                      });
                    }}
                    className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                      baseModalCopied ? "border-emerald-500/40 bg-emerald-500/10" : ""
                    }`}
                  >
                    {baseModalCopied ? "Copied" : "Copy all"}
                  </button>
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
                  {phoneticModalItems.length || 3} file(s) loaded in order
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
                  <button
                    type="button"
                    onClick={() => {
                      const combined = phoneticModalItems
                        .map((item) => item.text.trim())
                        .join("\n\n");
                      const tail = phoneticModalTailJson
                        ? `\n\n${phoneticModalTailJson}`
                        : "";
                      void navigator.clipboard.writeText(`${combined}${tail}`).then(() => {
                        setPhoneticModalCopied(true);
                        window.setTimeout(() => setPhoneticModalCopied(false), 1200);
                      });
                    }}
                    className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                      phoneticModalCopied ? "border-emerald-500/40 bg-emerald-500/10" : ""
                    }`}
                  >
                    {phoneticModalCopied ? "Copied" : "Copy all"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={`${phoneticModalItems
                    .map((item) => item.text.trim())
                    .join("\n\n")}${phoneticModalTailJson ? `\n\n${phoneticModalTailJson}` : ""}`}
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
                  Apply meaning_fa_IPA (per row)
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Paste JSON in Prompt (left): [{"{"}id, meaning_fa_IPA{"}"}] then open this modal.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMeaningIpaModalOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
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
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">id</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">base_form</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">meaning_fa</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">meaning_fa_IPA (DB)</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">meaning_fa_IPA (input/edit)</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">action</th>
                  </tr>
                </thead>
                <tbody>
                  {meaningIpaRows.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="whitespace-nowrap px-3 py-2 font-mono">{r.id}</td>
                      <td className="whitespace-nowrap px-3 py-2">{r.base_form}</td>
                      <td className="max-w-[320px] truncate px-3 py-2" title={r.meaning_fa}>
                        {r.meaning_fa}
                      </td>
                      <td className="max-w-[260px] truncate px-3 py-2 font-mono" title={r.dbMeaningIpa}>
                        {r.dbMeaningIpa || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={r.inputMeaningIpa}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMeaningIpaRows((cur) =>
                              cur.map((x) => (x.id === r.id ? { ...x, inputMeaningIpa: v, saved: false } : x)),
                            );
                          }}
                          onFocus={(e) => {
                            lastFocusedMeaningIpaInputRef.current = e.currentTarget;
                            lastFocusedMeaningIpaIdRef.current = r.id;
                          }}
                          className="h-9 w-[320px] rounded border border-card bg-background px-3 font-mono text-xs outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        {r.saveError ? (
                          <div className="mt-1 max-w-[360px] truncate text-[11px] text-red-600" title={r.saveError}>
                            {r.saveError}
                          </div>
                        ) : null}
                        {r.saved ? <div className="mt-1 text-[11px] text-green-700">Saved</div> : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void saveMeaningIpa(r.id, r.inputMeaningIpa)}
                          disabled={r.saving}
                          className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                          title="Updates meaning_fa_IPA and meaning_fa_IPA_normalized for this row"
                        >
                          {r.saving ? "Saving…" : "Update"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {meaningIpaRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-sm opacity-70">
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
                  Phase 3 — phonetic_us + imageability
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Prompt files + 20 missing rows (id/base_form/meaning_fa)
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
                  <button
                    type="button"
                    onClick={() => {
                      const combined = base2ModalItems
                        .map((item) => item.text.trim())
                        .join("\n\n");
                      const tail = base2ModalTailJson
                        ? `\n\n${base2ModalTailJson}`
                        : "";
                      void navigator.clipboard.writeText(`${combined}${tail}`).then(() => {
                        setBase2ModalCopied(true);
                        window.setTimeout(() => setBase2ModalCopied(false), 1200);
                      });
                    }}
                    className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                      base2ModalCopied ? "border-emerald-500/40 bg-emerald-500/10" : ""
                    }`}
                  >
                    {base2ModalCopied ? "Copied" : "Copy all"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={`${base2ModalItems
                    .map((item) => item.text.trim())
                    .join("\n\n")}${base2ModalTailJson ? `\n\n${base2ModalTailJson}` : ""}`}
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
                  Phase 4 — sentence meaning (FA)
                </div>
                <div className="mt-1 text-xs opacity-70">
                  Prompt files + 20 missing rows
                </div>
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs opacity-70">
                    {phase4PromptModalItems.length} file(s)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const combined = phase4PromptModalItems
                        .map((item) => item.text.trim())
                        .join("\n\n");
                      const tail = phase4PromptModalTailJson
                        ? `\n\n${phase4PromptModalTailJson}`
                        : "";
                      void navigator.clipboard.writeText(`${combined}${tail}`).then(() => {
                        setPhase4PromptModalCopied(true);
                        window.setTimeout(() => setPhase4PromptModalCopied(false), 1200);
                      });
                    }}
                    className={`rounded border px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/5 ${
                      phase4PromptModalCopied ? "border-emerald-500/40 bg-emerald-500/10" : ""
                    }`}
                  >
                    {phase4PromptModalCopied ? "Copied" : "Copy all"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={`${phase4PromptModalItems
                    .map((item) => item.text.trim())
                    .join("\n\n")}${phase4PromptModalTailJson ? `\n\n${phase4PromptModalTailJson}` : ""}`}
                  className="min-h-0 flex-1 resize-none rounded border bg-transparent p-3 font-mono text-xs"
                />
              </div>
            )}
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
                <div className="text-base font-semibold">Word Extraction — help</div>
                <div className="mt-1 text-xs opacity-70">src/helps/wordExtraction.md</div>
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
                    helpModalSaveOk ? "border-emerald-500/40 bg-emerald-500/10" : ""
                  }`}
                  title="Save changes to src/helps/wordExtraction.md"
                >
                  {isHelpModalSaving ? "Saving…" : helpModalSaveOk ? "Saved" : "Save"}
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
