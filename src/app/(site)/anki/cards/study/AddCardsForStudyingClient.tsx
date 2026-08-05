"use client";

import { useState, useMemo } from "react";
import { ankiOperations, WordAnkiConstants, chunkArray } from "@/lib/anki";
import { PageHeader } from "@/components/page-header";

function buildQueries(ankiLinkId: string) {
  const trimmed = ankiLinkId.trim();
  if (!trimmed) return [];
  const quoted = `"${trimmed.replaceAll('"', '\\"')}"`;
  return [
    `anki_link_id:${trimmed}`,
    `anki_link_id:${quoted}`,
    `AnkiLinkId:${trimmed}`,
    `AnkiLinkId:${quoted}`,
  ];
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type BaseFormLookupInputItem = {
  base_form?: string;
  meaning_fa?: string;
  anki_link_id?: string;
};

type NormalizedBaseFormLookupInput = {
  items: BaseFormLookupInputItem[];
  sourceLabel: string;
};

type SearchWordRow = {
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

type StudyQueuePreview = {
  sourceAnkiLinkIds: string[];
  expandedAnkiLinkIds: string[];
  ankiNoteIds: number[];
  moveEnToFa: number[];
  moveFaToEn: number[];
};

function toBaseFormLookupItem(value: unknown): BaseFormLookupInputItem | null {
  if (!isRecord(value)) return null;

  const baseForm = asTrimmedString(value.base_form);
  const meaningFa = asTrimmedString(value.meaning_fa);
  const ankiLinkId = asTrimmedString(value.anki_link_id);

  if (!baseForm && !ankiLinkId) return null;

  return {
    ...(baseForm ? { base_form: baseForm } : {}),
    ...(meaningFa ? { meaning_fa: meaningFa } : {}),
    ...(ankiLinkId ? { anki_link_id: ankiLinkId } : {}),
  };
}

function normalizeBaseFormLookupInput(
  value: unknown,
): NormalizedBaseFormLookupInput {
  if (!Array.isArray(value)) {
    throw new Error("JSON must be an array.");
  }

  const sentenceExtractionItems = value.flatMap((sentenceItem) => {
    if (!isRecord(sentenceItem) || !Array.isArray(sentenceItem.items))
      return [];
    return sentenceItem.items
      .map(toBaseFormLookupItem)
      .filter((item): item is BaseFormLookupInputItem => item !== null);
  });

  if (sentenceExtractionItems.length > 0) {
    return {
      items: sentenceExtractionItems,
      sourceLabel: `word-extraction: ${sentenceExtractionItems.length} item`,
    };
  }

  const directItems = value
    .map(toBaseFormLookupItem)
    .filter((item): item is BaseFormLookupInputItem => item !== null);

  return {
    items: directItems,
    sourceLabel: `direct array: ${directItems.length} item`,
  };
}

const DEFAULT_BASE_FORM_LOOKUP_JSON = `[
  { "base_form": "default", "meaning_fa": "پیش‌فرض" },
  { "base_form": "layout", "meaning_fa": "چیدمان" }
]`;

const AddCardsForStudyingClient = () => {
  const [baseFormLookupModalOpen, setBaseFormLookupModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [searchRows, setSearchRows] = useState<SearchWordRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<StudyQueuePreview | null>(null);
  const [previewSourceWord, setPreviewSourceWord] = useState<SearchWordRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [baseFormLookupJson, setBaseFormLookupJson] = useState(
    DEFAULT_BASE_FORM_LOOKUP_JSON,
  );
  const [baseFormLookupLoading, setBaseFormLookupLoading] = useState(false);
  const [baseFormLookupError, setBaseFormLookupError] = useState<string | null>(
    null,
  );
  const [baseFormLookupLog, setBaseFormLookupLog] = useState("[]");
  const [baseFormLookupNoteIds, setBaseFormLookupNoteIds] = useState<string[]>(
    [],
  );
  const [baseFormLookupInputStatus, setBaseFormLookupInputStatus] = useState<
    string | null
  >(null);
  const [baseFormQueueLoading, setBaseFormQueueLoading] = useState(false);
  const [baseFormQueueStatus, setBaseFormQueueStatus] = useState<string | null>(
    null,
  );

  const normalizedBaseFormLookupInput = useMemo(() => {
    try {
      const parsed = JSON.parse(baseFormLookupJson);
      const normalized = normalizeBaseFormLookupInput(parsed);
      setBaseFormLookupInputStatus(
        `OK: ${normalized.sourceLabel} (${normalized.items.length} items)`,
      );
      return normalized;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseFormLookupInputStatus(`Error: ${message}`);
      return null;
    }
  }, [baseFormLookupJson]);

  async function handleBaseFormLookup() {
    if (!normalizedBaseFormLookupInput) return;
    setBaseFormLookupLoading(true);
    setBaseFormLookupError(null);
    setBaseFormLookupLog("[]");
    setBaseFormLookupNoteIds([]);

    try {
      const res = await fetch("/api/anki-note/base-form-note-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedBaseFormLookupInput.items),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to look up note IDs.");
      }
      const noteIds = Array.isArray(data.noteIds) ? data.noteIds : [];
      setBaseFormLookupLog(JSON.stringify(noteIds, null, 2));
      setBaseFormLookupNoteIds(noteIds);
      setBaseFormLookupInputStatus(
        `${normalizedBaseFormLookupInput.sourceLabel} -> ${noteIds.length} anki_link_id`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseFormLookupError(message);
      setBaseFormLookupNoteIds([]);
      setBaseFormLookupLog("[]");
    } finally {
      setBaseFormLookupLoading(false);
    }
  }

  async function handleAddWordsToStudyQueue() {
    if (!baseFormLookupNoteIds.length) return;
    setBaseFormQueueLoading(true);
    setBaseFormQueueStatus(null);

    try {
      const uniqueAnkiLinkIds = Array.from(
        new Set(
          baseFormLookupNoteIds.map((item) => item.trim()).filter(Boolean),
        ),
      );

      if (uniqueAnkiLinkIds.length === 0) {
        setBaseFormQueueStatus("موردی برای انتقال انتخاب نشده است.");
        return;
      }

      setBaseFormQueueStatus("گسترش ساختار درختی بر اساس anki_link_id…");

      const lookupRes = await fetch("/api/anki-note/base-form-note-ids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          uniqueAnkiLinkIds.map((anki_link_id) => ({ anki_link_id })),
        ),
      });
      const lookupData = (await lookupRes.json()) as {
        ok?: boolean;
        error?: string;
        noteIds?: unknown[];
      };
      if (!lookupRes.ok || !lookupData.ok) {
        throw new Error(
          lookupData.error || `Request failed (${lookupRes.status})`,
        );
      }

      const expandedAnkiLinkIds = Array.from(
        new Set(
          (Array.isArray(lookupData.noteIds) ? lookupData.noteIds : [])
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean),
        ),
      );

      if (expandedAnkiLinkIds.length === 0) {
        setBaseFormQueueStatus("هیچ anki_link_id معتبری برای انتقال پیدا نشد.");
        return;
      }

      setBaseFormQueueStatus("Finding Anki notes by anki_link_id…");

      const noteIdsSet = new Set<number>();

      for (const ankiLinkId of expandedAnkiLinkIds) {
        const queries = buildQueries(ankiLinkId);
        let matchedNoteIds: number[] = [];

        for (const query of queries) {
          const res = await ankiOperations.findNotes({ query });
          if (!res.ok) {
            throw new Error(res.error);
          }
          matchedNoteIds = res.result ?? [];
          if (matchedNoteIds.length > 0) break;
        }

        for (const noteId of matchedNoteIds) {
          noteIdsSet.add(noteId);
        }
      }

      const noteIds = Array.from(noteIdsSet);

      if (noteIds.length === 0) {
        setBaseFormQueueStatus(
          "No Anki notes found for extracted anki_link_id values.",
        );
        return;
      }

      setBaseFormQueueStatus(`Selecting cards from ${noteIds.length} note(s)…`);

      const candidateEnToFa = new Set<number>();
      const candidateFaToEn = new Set<number>();

      for (const noteId of noteIds) {
        const enRes = await ankiOperations.findCards({
          query: `nid:${noteId} card:"EnToFa"`,
        });
        if (!enRes.ok) {
          throw new Error(enRes.error);
        }
        for (const id of enRes.result ?? []) candidateEnToFa.add(id);

        const faRes = await ankiOperations.findCards({
          query: `nid:${noteId} card:"FaToEn"`,
        });
        if (!faRes.ok) {
          throw new Error(faRes.error);
        }
        for (const id of faRes.result ?? []) candidateFaToEn.add(id);
      }

      const moveEnToFa = Array.from(candidateEnToFa);
      const moveFaToEn = Array.from(candidateFaToEn);

      if (moveEnToFa.length === 0 && moveFaToEn.length === 0) {
        setBaseFormQueueStatus(
          "No EnToFa/FaToEn cards found for selected notes.",
        );
        return;
      }

      setBaseFormQueueStatus("Moving cards to target decks…");

      if (moveEnToFa.length) {
        for (const chunk of chunkArray(moveEnToFa, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: WordAnkiConstants.decks.EnToFaKnowingFilter,
          });
          if (!res.ok) throw new Error(res.error);
        }
      }

      if (moveFaToEn.length) {
        for (const chunk of chunkArray(moveFaToEn, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: WordAnkiConstants.decks.FaToEnKnowingFilter,
          });
          if (!res.ok) throw new Error(res.error);
        }
      }

      setBaseFormQueueStatus(
        `Done. Notes=${noteIds.length}. Moves: EnToFa=${moveEnToFa.length}, FaToEn=${moveFaToEn.length}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseFormQueueStatus(`Error: ${message}`);
    } finally {
      setBaseFormQueueLoading(false);
    }
  }

  async function buildStudyQueuePreview(
    inputAnkiLinkIds: string[],
  ): Promise<StudyQueuePreview> {
    const uniqueAnkiLinkIds = Array.from(
      new Set(inputAnkiLinkIds.map((item) => item.trim()).filter(Boolean)),
    );

    if (uniqueAnkiLinkIds.length === 0) {
      throw new Error("موردی برای انتقال انتخاب نشده است.");
    }

    const lookupRes = await fetch("/api/anki-note/base-form-note-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        uniqueAnkiLinkIds.map((anki_link_id) => ({ anki_link_id })),
      ),
    });
    const lookupData = (await lookupRes.json()) as {
      ok?: boolean;
      error?: string;
      noteIds?: unknown[];
    };
    if (!lookupRes.ok || !lookupData.ok) {
      throw new Error(lookupData.error || `Request failed (${lookupRes.status})`);
    }

    const expandedAnkiLinkIds = Array.from(
      new Set(
        (Array.isArray(lookupData.noteIds) ? lookupData.noteIds : [])
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean),
      ),
    );

    if (expandedAnkiLinkIds.length === 0) {
      throw new Error("هیچ anki_link_id معتبری برای انتقال پیدا نشد.");
    }

    const noteIdsSet = new Set<number>();

    for (const ankiLinkId of expandedAnkiLinkIds) {
      const queries = buildQueries(ankiLinkId);
      let matchedNoteIds: number[] = [];

      for (const query of queries) {
        const res = await ankiOperations.findNotes({ query });
        if (!res.ok) {
          throw new Error(res.error);
        }
        matchedNoteIds = res.result ?? [];
        if (matchedNoteIds.length > 0) break;
      }

      for (const noteId of matchedNoteIds) {
        noteIdsSet.add(noteId);
      }
    }

    const ankiNoteIds = Array.from(noteIdsSet);

    if (ankiNoteIds.length === 0) {
      throw new Error("No Anki notes found for extracted anki_link_id values.");
    }

    const candidateEnToFa = new Set<number>();
    const candidateFaToEn = new Set<number>();

    for (const noteId of ankiNoteIds) {
      const enRes = await ankiOperations.findCards({
        query: `nid:${noteId} card:"EnToFa"`,
      });
      if (!enRes.ok) throw new Error(enRes.error);
      for (const id of enRes.result ?? []) candidateEnToFa.add(id);

      const faRes = await ankiOperations.findCards({
        query: `nid:${noteId} card:"FaToEn"`,
      });
      if (!faRes.ok) throw new Error(faRes.error);
      for (const id of faRes.result ?? []) candidateFaToEn.add(id);
    }

    const moveEnToFa = Array.from(candidateEnToFa);
    const moveFaToEn = Array.from(candidateFaToEn);

    if (moveEnToFa.length === 0 && moveFaToEn.length === 0) {
      throw new Error("No EnToFa/FaToEn cards found for selected notes.");
    }

    return {
      sourceAnkiLinkIds: uniqueAnkiLinkIds,
      expandedAnkiLinkIds,
      ankiNoteIds,
      moveEnToFa,
      moveFaToEn,
    };
  }

  async function submitSearch() {
    const q = searchQuery.trim();
    setSearchLoading(true);
    setSearchError(null);
    setSearchStatus(null);
    setSearchRows([]);

    try {
      if (!q) {
        setSearchStatus("یک کلمه برای جستجو وارد کن.");
        return;
      }

      const url = new URL(
        "/api/add-cards-for-studying/search-words",
        window.location.origin,
      );
      url.searchParams.set("q", q);

      const res = await fetch(url.toString());
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        items?: SearchWordRow[];
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const items = Array.isArray(data.items) ? data.items : [];
      setSearchRows(items);
      setSearchStatus(
        items.length ? `${items.length} رکورد پیدا شد.` : "نتیجه‌ای پیدا نشد.",
      );
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearchLoading(false);
    }
  }

  async function openPreviewForWord(row: SearchWordRow) {
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewStatus("در حال ساخت پیش‌نمایش ساختار درختی...");
    setPreviewSourceWord(row);
    setPreviewData(null);
    setPreviewModalOpen(true);

    try {
      const preview = await buildStudyQueuePreview([row.anki_link_id]);
      setPreviewData(preview);
      setPreviewStatus(
        `آماده برای بررسی: ${preview.expandedAnkiLinkIds.length} anki_link_id و ${preview.ankiNoteIds.length} note.`,
      );
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
      setPreviewStatus(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmPreviewAddToStudyQueue() {
    if (!previewData) return;

    setConfirmLoading(true);
    setPreviewError(null);

    try {
      if (previewData.moveEnToFa.length) {
        for (const chunk of chunkArray(previewData.moveEnToFa, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: WordAnkiConstants.decks.EnToFaKnowingFilter,
          });
          if (!res.ok) throw new Error(res.error);
        }
      }

      if (previewData.moveFaToEn.length) {
        for (const chunk of chunkArray(previewData.moveFaToEn, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: WordAnkiConstants.decks.FaToEnKnowingFilter,
          });
          if (!res.ok) throw new Error(res.error);
        }
      }

      setPreviewStatus(
        `انجام شد. EnToFa=${previewData.moveEnToFa.length} و FaToEn=${previewData.moveFaToEn.length}.`,
      );
      setPreviewModalOpen(false);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : String(error));
    } finally {
      setConfirmLoading(false);
    }
  }

  async function pasteBaseFormLookupJson() {
    setBaseFormLookupError(null);
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error("Clipboard read is not available in this browser.");
      }

      const text = await navigator.clipboard.readText();
      setBaseFormLookupJson(text);
      setBaseFormLookupNoteIds([]);
      setBaseFormLookupLog("[]");
      setBaseFormLookupInputStatus(null);
      setBaseFormQueueStatus(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBaseFormLookupError(message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl p-4">
      <div dir="rtl" className="flex flex-col gap-6">
        <PageHeader
          title="Add Cards For Studying"
          subtitle="جستجوی کلمه، بررسی خروجی ساختار درختی، و انتقال کارت‌ها به deckهای Knowing Filter"
        />

        <section className="rounded-3xl border border-card bg-card p-5 shadow-elevated">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)] xl:items-start">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-lg font-semibold text-foreground">
                  مسیر اصلی: جستجوی کلمه و افزودن کنترل‌شده
                </div>
                <div className="max-w-3xl text-sm leading-7 text-muted">
                  اول کلمه را جستجو کن، بعد نتیجه‌ی درست را در جدول انتخاب کن،
                  پیش‌نمایش ساختار درختی و کارت‌های مقصد را ببین، و در نهایت فقط
                  اگر خروجی درست بود آن را به deckهای مطالعه منتقل کن.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-full border border-card bg-background px-3 py-2 text-xs font-medium text-foreground">
                  1. جستجو در <code>base_form</code>
                </div>
                <div className="rounded-full border border-card bg-background px-3 py-2 text-xs font-medium text-foreground">
                  2. پیش‌نمایش ساختار درختی
                </div>
                <div className="rounded-full border border-card bg-background px-3 py-2 text-xs font-medium text-foreground">
                  3. انتقال به Knowing Filter
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-card bg-background p-4">
              <div className="text-sm font-semibold text-foreground">ورود گروهی با JSON</div>
              <div className="text-xs leading-6 text-muted">
                اگر از قبل آرایه‌ی کلمات یا خروجی <code>word-extraction</code> را داری،
                از این مسیر برای ساخت گروهی صف مطالعه استفاده کن.
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                <span className="rounded-full border border-card px-3 py-1.5">ورودی: JSON</span>
                <span className="rounded-full border border-card px-3 py-1.5">گسترش: درختی</span>
              </div>
              <button
                type="button"
                className="h-11 rounded-xl border border-card bg-card px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-accent"
                onClick={() => {
                  setBaseFormLookupModalOpen(true);
                  setHelpModalOpen(false);
                  setBaseFormQueueStatus(null);
                }}
              >
                باز کردن ورود گروهی
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated">
          <div className="flex flex-col gap-4 border-b border-card/80 pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-1">
              <div className="text-sm font-semibold text-foreground">جستجوی سریع</div>
              <div className="text-xs leading-6 text-muted">
                مناسب وقتی که می‌خواهی یک یا چند رکورد را سریع پیدا کنی و قبل از افزودن، خروجی را بررسی کنی.
              </div>
            </div>

            <div className="rounded-xl border border-card bg-background px-3 py-2 text-xs text-muted">
              مقصد کارت‌ها: <code>{WordAnkiConstants.decks.EnToFaKnowingFilter}</code> و <code>{WordAnkiConstants.decks.FaToEnKnowingFilter}</code>
            </div>
          </div>

          <div className="pt-4">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitSearch();
            }}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(18rem,1fr)_auto] lg:items-end">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">
                  جستجو بر اساس فیلد لغت
                </span>
                <input
                  dir="ltr"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="example"
                  className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </label>
              <button
                type="submit"
                disabled={searchLoading}
                className="h-11 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {searchLoading ? "در حال جستجو..." : "جستجو"}
              </button>
            </div>
            <div className="text-xs text-muted">
              کلمه را وارد کن و Enter بزن. فقط فیلد <code>base_form</code> در دیتابیس جستجو می‌شود.
            </div>
            {searchError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700">
                {searchError}
              </div>
            ) : null}
            {searchStatus ? <div className="text-xs text-muted">{searchStatus}</div> : null}
          </form>

          {searchRows.length ? (
            <section className="mt-5 rounded-2xl border border-card bg-background p-2">
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <p className="text-sm font-semibold text-foreground">
                  {searchRows.length.toLocaleString()} رکورد
                </p>
                <p className="text-xs text-muted">
                  نتیجه‌ها فقط بر اساس فیلد <code>base_form</code> نمایش داده می‌شوند.
                </p>
              </div>

              <div className="overflow-auto rounded-xl border border-card bg-background">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-card">
                      <th className="px-3 py-2 text-right font-semibold">#</th>
                      <th className="px-3 py-2 text-left font-semibold">Word</th>
                      <th dir="rtl" className="w-48 px-3 py-2 text-right font-semibold">
                        Meaning
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">Sentence</th>
                      <th dir="rtl" className="px-3 py-2 text-right font-semibold">
                        Sentence Meaning
                      </th>
                      <th className="px-3 py-2 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchRows.map((row, index) => (
                      <tr
                        key={`${row.anki_link_id}-${row.base_form}`}
                        className="border-b border-card last:border-b-0"
                      >
                        <td className="px-3 py-3 align-top text-foreground/70">
                          {index + 1}
                        </td>
                        <td className="max-w-52 px-3 py-3 align-top text-foreground">
                          {row.base_form ? (
                            <span dir="ltr" className="whitespace-pre-wrap">
                              {row.base_form}
                            </span>
                          ) : (
                            <span className="opacity-50">—</span>
                          )}
                        </td>
                        <td
                          dir="rtl"
                          className="w-48 max-w-48 px-3 py-3 text-right align-top text-foreground"
                        >
                          {row.meaning_fa ? (
                            <span className="whitespace-pre-wrap">{row.meaning_fa}</span>
                          ) : (
                            <span className="opacity-50">—</span>
                          )}
                        </td>
                        <td className="max-w-80 px-3 py-3 align-top text-foreground">
                          {row.sentence_en ? (
                            <span dir="ltr" className="whitespace-pre-wrap">
                              {row.sentence_en}
                            </span>
                          ) : (
                            <span className="opacity-50">—</span>
                          )}
                        </td>
                        <td
                          dir="rtl"
                          className="max-w-80 px-3 py-3 text-right align-top text-foreground"
                        >
                          {row.sentence_en_meaning_fa ? (
                            <span className="whitespace-pre-wrap">
                              {row.sentence_en_meaning_fa}
                            </span>
                          ) : (
                            <span className="opacity-50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <button
                            type="button"
                            onClick={() => void openPreviewForWord(row)}
                            disabled={previewLoading}
                            className="h-10 rounded-xl border border-card bg-card px-3 text-xs font-semibold text-foreground shadow-elevated transition hover:bg-accent disabled:opacity-60"
                          >
                            افزودن به دک‌های مطالعه
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : searchQuery.trim() && !searchLoading && !searchError ? (
            <div className="mt-5 rounded-2xl border border-dashed border-card bg-background/60 p-8 text-center">
              <div className="text-sm font-semibold text-foreground">نتیجه‌ای پیدا نشد</div>
              <div className="mt-1 text-xs text-muted">
                جستجو فقط روی فیلد <code>base_form</code> انجام می‌شود. عبارت دیگری را امتحان کن.
              </div>
            </div>
          ) : !searchRows.length && !searchQuery.trim() ? (
            <div className="mt-5 rounded-2xl border border-dashed border-card bg-background/60 p-8 text-center">
              <div className="text-sm font-semibold text-foreground">آماده برای جستجو</div>
              <div className="mt-1 text-xs text-muted">
                کلمه را وارد کن تا نتیجه‌ها در جدول نمایش داده شوند.
              </div>
            </div>
          ) : null}
          </div>
        </section>
      </div>

      {previewModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            dir="rtl"
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-card bg-card p-5 shadow-elevated"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-right">
                <div className="text-base font-semibold text-foreground">
                  پیش‌نمایش افزودن به دک‌های مطالعه
                </div>
                <div className="mt-1 text-xs text-muted">
                  {previewSourceWord ? (
                    <>
                      برای <span dir="ltr">{previewSourceWord.base_form}</span> ابتدا خروجی ساختار درختی
                      و کارت‌های مقصد نشان داده می‌شود.
                    </>
                  ) : (
                    "ابتدا خروجی ساختار درختی و کارت‌های مقصد نشان داده می‌شود."
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="h-9 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                بستن
              </button>
            </div>

            {previewError ? (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                {previewError}
              </div>
            ) : null}
            {previewStatus ? (
              <div className="mt-3 text-xs text-muted">{previewStatus}</div>
            ) : null}

            {previewData ? (
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-card bg-background p-3">
                  <div className="text-xs text-muted">کلمه مبدا</div>
                  <div dir="ltr" className="mt-1 text-sm font-semibold text-foreground">
                    {previewSourceWord?.base_form ?? "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-card bg-background p-3">
                  <div className="text-xs text-muted">شاخه‌های پیدا شده</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {previewData.expandedAnkiLinkIds.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-card bg-background p-3">
                  <div className="text-xs text-muted">تعداد note</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {previewData.ankiNoteIds.length}
                  </div>
                </div>
                <div className="rounded-2xl border border-card bg-background p-3">
                  <div className="text-xs text-muted">کارت‌های قابل انتقال</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {previewData.moveEnToFa.length + previewData.moveFaToEn.length}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="text-xs font-semibold text-muted">
                  anki_link_id های انتخاب‌شده بعد از گسترش درختی
                </div>
                <textarea
                  readOnly
                  dir="ltr"
                  value={JSON.stringify(previewData?.expandedAnkiLinkIds ?? [], null, 2)}
                  className="min-h-[16rem] flex-1 resize-none rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
                />
              </div>
              <div className="flex min-h-0 flex-col gap-2">
                <div className="text-xs font-semibold text-muted">
                  کارت‌هایی که اضافه می‌شوند
                </div>
                <textarea
                  readOnly
                  dir="ltr"
                  value={JSON.stringify(
                    {
                      noteIds: previewData?.ankiNoteIds ?? [],
                      enToFaCards: previewData?.moveEnToFa ?? [],
                      faToEnCards: previewData?.moveFaToEn ?? [],
                    },
                    null,
                    2,
                  )}
                  className="min-h-[16rem] flex-1 resize-none rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!previewData || previewLoading || confirmLoading}
                onClick={() => void confirmPreviewAddToStudyQueue()}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {confirmLoading ? "در حال افزودن..." : "تأیید و افزودن"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {baseFormLookupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-card bg-card p-5 shadow-elevated"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-right">
                <div className="text-base font-semibold text-foreground">
                  قرار دادن در صف مطالعه
                </div>
                <div className="mt-1 text-xs text-muted">
                  آرایه مستقیم کلمات یا خروجی <code>word-extraction</code> را
                  paste کن. اگر ورودی شامل <code>items</code> باشد، همه آیتم‌ها
                  flatten می‌شوند و بعد با <code>base_form</code> در جدول{" "}
                  <code>Word</code> جستجو می‌شوند.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBaseFormLookupModalOpen(false);
                  setHelpModalOpen(false);
                }}
                className="h-9 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                بستن
              </button>
            </div>

            {baseFormLookupError ? (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                {baseFormLookupError}
              </div>
            ) : null}

            <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted">
                    ورودی JSON: آرایه کلمات یا خروجی extract from sentences
                  </div>
                  {baseFormLookupInputStatus ? (
                    <div className="text-xs text-muted">
                      {baseFormLookupInputStatus}
                    </div>
                  ) : null}
                </div>
                <textarea
                  id="base-form-json"
                  dir="ltr"
                  value={baseFormLookupJson}
                  onChange={(e) => setBaseFormLookupJson(e.target.value)}
                  className="min-h-[18rem] flex-1 resize-none rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void pasteBaseFormLookupJson()}
                    className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    پیست
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                    onClick={() => void handleBaseFormLookup()}
                    disabled={
                      baseFormLookupLoading || !normalizedBaseFormLookupInput
                    }
                  >
                    {baseFormLookupLoading
                      ? "در حال جستجو..."
                      : "ساختن آرایه note"}
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                    onClick={() => void handleAddWordsToStudyQueue()}
                    disabled={
                      baseFormQueueLoading || baseFormLookupNoteIds.length === 0
                    }
                  >
                    {baseFormQueueLoading
                      ? "در حال افزودن..."
                      : "افزودن به صف مطالعه"}
                  </button>
                </div>
                {baseFormQueueStatus ? (
                  <div className="text-xs text-muted">
                    {baseFormQueueStatus}
                  </div>
                ) : null}
              </div>

              <div className="flex min-h-0 flex-col gap-2">
                <div className="text-xs font-semibold text-muted">لاگ</div>
                <textarea
                  dir="ltr"
                  readOnly
                  value={baseFormLookupLog}
                  className="min-h-[18rem] flex-1 resize-none rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground"
                />
              </div>
            </div>

            <button
              type="button"
              aria-label="راهنمای ورودی و کارت‌ها"
              title="راهنما"
              className="absolute left-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-card bg-background text-foreground shadow-elevated transition hover:bg-accent"
              onClick={() => setHelpModalOpen(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9.75 9a2.25 2.25 0 1 1 3.39 1.94c-.92.54-1.39 1-1.39 2.06" />
                <circle cx="12" cy="16.75" r=".75" fill="currentColor" stroke="none" />
              </svg>
            </button>

            {helpModalOpen ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
                onClick={() => setHelpModalOpen(false)}
              >
                <div
                  dir="rtl"
                  className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-card bg-card p-5 shadow-elevated"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-right">
                      <div className="text-base font-semibold text-foreground">
                        راهنمای گروه
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        این بخش از ورودی JSON، گروهی از نوت‌ها را پیدا می‌کند و فقط
                        کارت‌های مشخصی را به دک‌های Knowing Filter می‌فرستد.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHelpModalOpen(false)}
                      className="h-9 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      بستن
                    </button>
                  </div>

                  <div className="mt-4 grid gap-4 text-sm text-foreground">
                    <div dir="rtl" className="rounded-xl border border-card bg-background p-4">
                      <div className="mb-2 font-semibold">ورودی قابل قبول</div>
                      <div className="text-xs text-muted">
                        دو فرم ورودی پشتیبانی می‌شود: آرایه مستقیم کلمات، یا خروجی
                        ساختاریافته‌ای که داخل آن <code>items</code> وجود دارد.
                      </div>
                      <pre
                        className="mt-3 overflow-auto rounded-lg border border-card bg-card p-3 text-xs"
                        dir="ltr"
                      >{`[
  { "base_form": "default", "meaning_fa": "پیش‌فرض" },
  { "anki_link_id": "some-id" }
]`}</pre>
                      <pre
                        className="mt-3 overflow-auto rounded-lg border border-card bg-card p-3 text-xs"
                        dir="ltr"
                      >{`[
  {
    "items": [
      { "base_form": "default", "meaning_fa": "پیش‌فرض" },
      { "base_form": "layout", "meaning_fa": "چیدمان" }
    ]
  }
]`}</pre>
                    </div>

                    <div dir="rtl" className="rounded-xl border border-card bg-background p-4">
                      <div className="mb-2 font-semibold">
                        چه کارت‌هایی اضافه می‌شوند
                      </div>
                      <div className="text-xs text-muted">
                        بعد از پیدا شدن نوت‌ها و گسترش درختی بر اساس <code>anki_link_id</code>، فقط این دسته کارت‌ها جابه‌جا می‌شوند:
                      </div>
                      <ul className="mt-3 list-disc space-y-1 ps-5 text-xs text-foreground/85">
                        <li>
                          کارت‌های <code>EnToFa</code> به دک <code>{WordAnkiConstants.decks.EnToFaKnowingFilter}</code>
                        </li>
                        <li>
                          کارت‌های <code>FaToEn</code> به دک <code>{WordAnkiConstants.decks.FaToEnKnowingFilter}</code>
                        </li>
                      </ul>
                    </div>

                    <div dir="rtl" className="rounded-xl border border-card bg-background p-4">
                      <div className="mb-2 font-semibold">سرچ درختی یعنی چه؟</div>
                      <div className="text-xs leading-6 text-muted">
                        اینجا منظور از سرچ درختی این نیست که متن راهنما یا جمله‌ها
                        کلمه‌به‌کلمه خوانده شوند. این flow اول از روی
                        <code>base_form</code> یا <code>anki_link_id</code> ورودی،
                        چند <code>anki_link_id</code> اولیه پیدا می‌کند.
                      </div>
                      <div className="mt-3 text-xs leading-6 text-muted">
                        بعد برای هر رکوردِ پیدا شده در جدول <code>Word</code>، فیلد
                        <code>json_hint</code> بررسی می‌شود. اگر داخل
                        <code>json_hint</code> در بخش <code>person</code> یا
                        <code>job</code> یک آیتم انگلیسی وجود داشته باشد
                        یعنی <code>target_lang</code> آن برابر <code>en</code> باشد
                        و برایش <code>anki_link_id</code> ثبت شده باشد، همان
                        شناسه هم به لیست اضافه می‌شود.
                      </div>
                      <div className="mt-3 text-xs leading-6 text-muted">
                        به زبان ساده: اگر یک کلمه در <code>json_hint</code> خودش به یک
                        شخص یا شغل انگلیسی اشاره کرده باشد، آن کلمه‌های اشاره‌شده هم
                        وارد جستجو می‌شوند. بعد این روند برای آن‌ها هم تکرار می‌شود.
                        به همین خاطر اسمش سرچ درختی است؛ چون از یک کلمه شروع می‌کند و
                        از روی لینک‌های داخل <code>json_hint</code> شاخه‌های بعدی را هم
                        جلو می‌رود.
                      </div>
                      <div className="mt-3 text-xs leading-6 text-muted">
                        پس اگر دنبال توضیح دقیق فیلدها باشیم: این بخش به
                        <code>selfGuide</code> یا متن آزاد
                        راهنما کاری ندارد. فیلد تعیین‌کننده برای گسترش،
                        <code>json_hint</code> است و داخل آن هم مشخصاً
                        <code>person.anki_link_id</code> و <code>job.anki_link_id</code>
                        وقتی <code>target_lang</code> برابر <code>en</code> باشد.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
};

export default AddCardsForStudyingClient;
