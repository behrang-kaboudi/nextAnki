 "use client";

import { PageHeader } from "@/components/page-header";
import { useCallback, useMemo, useState } from "react";

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

  const [selectedPromptKey, setSelectedPromptKey] = useState("basePrompt");
  const [allowCopyPaste, setAllowCopyPaste] = useState(true);
  const [isLoadingBase, setIsLoadingBase] = useState(false);
  const [isClipboardBusy, setIsClipboardBusy] = useState(false);
  const [baseMeta, setBaseMeta] = useState<{
    rules?: { filename: string; version: number };
    guide?: { filename: string; version: number };
  }>({});

  const leftDir = useMemo(() => "ltr" as const, []);
  const rightDir = useMemo(() => "rtl" as const, []);

  const loadLatestBaseRulesAndGuide = useCallback(async () => {
    setIsLoadingBase(true);
    try {
      const response = await fetch("/api/word-extraction/base/latest", {
        method: "GET",
        headers: { "content-type": "application/json" },
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(errorBody || `Request failed: ${response.status}`);
      }

      const data: {
        rules: { content: string; filename: string; version: number };
        guide: { content: string; filename: string; version: number };
      } = await response.json();

      setPromptText(data.rules.content);
      setRightText(data.guide.content);
      setBaseMeta({
        rules: { filename: data.rules.filename, version: data.rules.version },
        guide: { filename: data.guide.filename, version: data.guide.version },
      });
      setSelectedPromptKey("basePrompt");
    } catch (error) {
      setRightText(
        `خطا در خواندن فایل‌های base.\n\n${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoadingBase(false);
    }
  }, []);

  const copyPromptToClipboard = useCallback(async () => {
    if (!allowCopyPaste) {
      setRightText("Copy/Paste غیرفعال است (Allow Copy/Paste).");
      return;
    }

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
  }, [allowCopyPaste, promptText]);

  const pastePromptFromClipboard = useCallback(async () => {
    if (!allowCopyPaste) {
      setRightText("Copy/Paste غیرفعال است (Allow Copy/Paste).");
      return;
    }

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
  }, [allowCopyPaste]);

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
              dir={leftDir}
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
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
              onClick={loadLatestBaseRulesAndGuide}
              disabled={isLoadingBase}
            >
              1.1 PROMPT FOR: CONVERT WORDS TO GET BASEDATA FROM AI
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
            >
              GET UNFINISHED WORDS
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
            >
              1.2 INSERT BASE FORTEMPWORDS
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
            >
              GENERATE AUDIO
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_280px]">
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

            <div className="grid gap-2">
              <select
                className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--primary),transparent_70%)]"
                value={selectedPromptKey}
                onChange={(event) => setSelectedPromptKey(event.target.value)}
              >
                <option value="basePrompt">basePrompt</option>
                <option value="phonetic_us">phonetic_us</option>
                <option value="sentence_en">sentence_en</option>
                <option value="meaning_fa">meaning_fa</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={allowCopyPaste}
                  onChange={(event) => setAllowCopyPaste(event.target.checked)}
                  className="h-4 w-4 rounded border border-card bg-background accent-[var(--primary)]"
                />
                Allow Copy/Paste
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-card bg-background/60 p-4 backdrop-blur lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-1">
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
            >
              2. ADD BASE2 FOR TEMP WORDS
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-purple-700 to-fuchsia-600 text-white`}
            >
              3. CREATE MIXED SENTENCE
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
            >
              UPDATE HINT TO SELECT FOR WORDS
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-1">
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
            >
              DATABASE JOBS: YOU CAN CHANGE
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
              onClick={loadLatestBaseRulesAndGuide}
              disabled={isLoadingBase}
            >
              {isLoadingBase ? "LOADING BASE PROMPT..." : "GET PROMPT DATA"}
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
            >
              PUT DATA IN DATABASE
            </button>
            <button
              type="button"
              className={`${buttonBase} bg-gradient-to-r from-blue-700 to-cyan-600 text-white`}
            >
              AUTO DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
