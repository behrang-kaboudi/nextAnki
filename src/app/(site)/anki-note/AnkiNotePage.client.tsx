"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  ankiOperations,
  createAnkiOperations,
  type AnkiNotesInfo,
} from "@/lib/anki";
import {
  AnkiNoteTypes,
  findCardIdsInDeck,
  getLastRevlogByCardIds,
  WordAnkiConstants,
} from "@/lib/anki";
import { imageabilityBaseThreshold } from "@/lib/ipa/setPictures/types";
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

function stripSoundTags(value: string): string {
  const cleaned = value
    .replace(/\[sound:[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function phoneticLength(value: unknown): number {
  const raw = typeof value === "string" ? value : "";
  const cleaned = raw.trim().replace(/\s+/g, "");
  return cleaned ? cleaned.length : Number.POSITIVE_INFINITY;
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

function normalizeBaseFormLookupInput(value: unknown): NormalizedBaseFormLookupInput {
  if (!Array.isArray(value)) {
    throw new Error("JSON must be an array.");
  }

  const sentenceExtractionItems = value.flatMap((sentenceItem) => {
    if (!isRecord(sentenceItem) || !Array.isArray(sentenceItem.items)) return [];
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

type StudyCandidateRow = {
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
  learning_depth?: number | null;
  sentence_en: string;
  sentence_en_meaning_fa: string;
};

type StudyCandidateResolvedRow = StudyCandidateRow & {
  noteId: number;
};

type SyncAllStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  error: string | null;
  stopRequested?: boolean;
  stoppedEarly?: boolean;
  total: number;
  processed: number;
  updated: number;
  skipped: number;
  failed: number;
  currentNoteId: number | null;
};

const DEFAULT_BASE_FORM_LOOKUP_JSON = `[
  { "base_form": "default", "meaning_fa": "پیش‌فرض" },
  { "base_form": "layout", "meaning_fa": "چیدمان" },
  { "base_form": "page", "meaning_fa": "صفحه" },
  { "base_form": "Server Component", "meaning_fa": "کامپوننت سمت سرور" },
  { "base_form": "fetch", "meaning_fa": "دریافت کردن" },
  { "base_form": "data", "meaning_fa": "داده" },
  { "base_form": "render", "meaning_fa": "رندر کردن" },
  { "base_form": "part", "meaning_fa": "بخش" },
  { "base_form": "optionally", "meaning_fa": "به‌صورت اختیاری" },
  { "base_form": "cache", "meaning_fa": "ذخیره موقت" },
  { "base_form": "result", "meaning_fa": "نتیجه" },
  { "base_form": "stream", "meaning_fa": "ارسال تدریجی" },
  { "base_form": "client", "meaning_fa": "کاربر" },
  { "base_form": "interactivity", "meaning_fa": "تعامل‌پذیری" },
  { "base_form": "browser", "meaning_fa": "مرورگر" },
  { "base_form": "Client Component", "meaning_fa": "کامپوننت سمت کلاینت" },
  { "base_form": "layer", "meaning_fa": "افزودن لایه‌ای" },
  { "base_form": "functionality", "meaning_fa": "قابلیت" },
  { "base_form": "explain", "meaning_fa": "توضیح دادن" },
  { "base_form": "work", "meaning_fa": "کار کردن" },
  { "base_form": "compose", "meaning_fa": "ترکیب کردن" },
  { "base_form": "together", "meaning_fa": "با هم" },
  { "base_form": "application", "meaning_fa": "برنامه" }
]`;

export default function AnkiNotePage() {
  const [ankiLinkId, setAnkiLinkId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notesInfo, setNotesInfo] = useState<AnkiNotesInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStudyCardCount, setSessionStudyCardCount] = useState(25);
  const [phaseLogs, setPhaseLogs] = useState<string[]>([]);
  const phaseLogBoxRef = useRef<HTMLDivElement | null>(null);
  const [phase0Running, setPhase0Running] = useState(false);
  const [phase0StatusText, setPhase0StatusText] = useState<string | null>(null);
  const [phase0Error, setPhase0Error] = useState<string | null>(null);
  const [phase1Running, setPhase1Running] = useState(false);
  const [phase1StatusText, setPhase1StatusText] = useState<string | null>(null);
  const [phase1Error, setPhase1Error] = useState<string | null>(null);
  const [phase2Running, setPhase2Running] = useState(false);
  const [phase2StatusText, setPhase2StatusText] = useState<string | null>(null);
  const [phase2Error, setPhase2Error] = useState<string | null>(null);
  const [phase3Running, setPhase3Running] = useState(false);
  const [phase3StatusText, setPhase3StatusText] = useState<string | null>(null);
  const [phase3Error, setPhase3Error] = useState<string | null>(null);
  const [runAllRunning, setRunAllRunning] = useState(false);
  const [runAllStatusText, setRunAllStatusText] = useState<string | null>(null);
  const [runAllError, setRunAllError] = useState<string | null>(null);
  const [phaseActionsEnabled, setPhaseActionsEnabled] = useState(false);
  const [browseLimit, setBrowseLimit] = useState(50);
  const [browseQueryExtra, setBrowseQueryExtra] = useState("");
  const [openNoteIds, setOpenNoteIds] = useState<Record<number, boolean>>({});
  const [updatingNoteIds, setUpdatingNoteIds] = useState<
    Record<number, boolean>
  >({});
  const [updateErrors, setUpdateErrors] = useState<
    Record<number, string | null>
  >({});
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);
  const [modelFields, setModelFields] = useState<string[] | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [syncAllStatusText, setSyncAllStatusText] = useState<string | null>(
    null,
  );
  const [syncAllRunning, setSyncAllRunning] = useState(false);
  const [syncAllError, setSyncAllError] = useState<string | null>(null);
  const [baseFormLookupModalOpen, setBaseFormLookupModalOpen] = useState(false);
  const [baseFormLookupJson, setBaseFormLookupJson] = useState(
    DEFAULT_BASE_FORM_LOOKUP_JSON,
  );
  const [baseFormLookupLoading, setBaseFormLookupLoading] = useState(false);
  const [baseFormLookupError, setBaseFormLookupError] = useState<string | null>(
    null,
  );
  const [baseFormLookupLog, setBaseFormLookupLog] = useState("[]");
  const [baseFormLookupNoteIds, setBaseFormLookupNoteIds] = useState<string[]>([]);
  const [baseFormLookupInputStatus, setBaseFormLookupInputStatus] = useState<string | null>(
    null,
  );
  const [baseFormQueueLoading, setBaseFormQueueLoading] = useState(false);
  const [baseFormQueueStatus, setBaseFormQueueStatus] = useState<string | null>(null);
  const [studyCandidatesModalOpen, setStudyCandidatesModalOpen] = useState(false);
  const [studyCandidatesQuery, setStudyCandidatesQuery] = useState("");
  const [studyCandidatesLoading, setStudyCandidatesLoading] = useState(false);
  const [studyCandidatesError, setStudyCandidatesError] = useState<string | null>(null);
  const [studyCandidatesStatus, setStudyCandidatesStatus] = useState<string | null>(null);
  const [studyCandidates, setStudyCandidates] = useState<StudyCandidateResolvedRow[]>([]);
  const [selectedStudyCandidateIds, setSelectedStudyCandidateIds] = useState<
    Record<string, StudyCandidateResolvedRow>
  >({});
  const [studyCandidatesApplyLoading, setStudyCandidatesApplyLoading] = useState(false);
  const [studyCandidatesApplyStatus, setStudyCandidatesApplyStatus] = useState<string | null>(
    null,
  );
  const [topLearningDepthLoading, setTopLearningDepthLoading] = useState(false);
  const [topLearningDepthStatus, setTopLearningDepthStatus] = useState<string | null>(null);
  const [topLearningDepthCount, setTopLearningDepthCount] = useState(10);

  const queries = useMemo(() => buildQueries(ankiLinkId), [ankiLinkId]);
  const phaseCount = 4;
  const numberOptions = useMemo(
    () => Array.from({ length: 100 }, (_, i) => i + 1),
    [],
  );
  const ankiSyncClient = useMemo(
    () => createAnkiOperations({ timeoutMs: 120_000, retryDelayMs: 1000 }),
    [],
  );

  const phase0RunningRef = useRef(false);
  const phase1RunningRef = useRef(false);
  const phase2RunningRef = useRef(false);
  const phase3RunningRef = useRef(false);
  const phase0ErrorRef = useRef<string | null>(null);
  const phase1ErrorRef = useRef<string | null>(null);
  const phase2ErrorRef = useRef<string | null>(null);
  const phase3ErrorRef = useRef<string | null>(null);

  useEffect(() => {
    phase0RunningRef.current = phase0Running;
  }, [phase0Running]);
  useEffect(() => {
    phase1RunningRef.current = phase1Running;
  }, [phase1Running]);
  useEffect(() => {
    phase2RunningRef.current = phase2Running;
  }, [phase2Running]);
  useEffect(() => {
    phase3RunningRef.current = phase3Running;
  }, [phase3Running]);
  useEffect(() => {
    phase0ErrorRef.current = phase0Error;
  }, [phase0Error]);
  useEffect(() => {
    phase1ErrorRef.current = phase1Error;
  }, [phase1Error]);
  useEffect(() => {
    phase2ErrorRef.current = phase2Error;
  }, [phase2Error]);
  useEffect(() => {
    phase3ErrorRef.current = phase3Error;
  }, [phase3Error]);

  function appendPhaseLog(line: string) {
    setPhaseLogs((prev) => [...prev, line]);
  }

  function appendPhaseLogIds(label: string, ids: number[], chunkSize = 50) {
    appendPhaseLog(`${label} (${ids.length})`);
    for (let i = 0; i < ids.length; i += chunkSize) {
      appendPhaseLog(ids.slice(i, i + chunkSize).join(", "));
    }
  }

  function appendPhaseLogPairs(label: string, pairs: string[], chunkSize = 30) {
    appendPhaseLog(`${label} (${pairs.length})`);
    for (let i = 0; i < pairs.length; i += chunkSize) {
      appendPhaseLog(pairs.slice(i, i + chunkSize).join(", "));
    }
  }

  function chunkArray<T>(items: T[], chunkSize: number) {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize)
      chunks.push(items.slice(i, i + chunkSize));
    return chunks;
  }

  function escapeAnkiQueryValue(value: string) {
    return value.replaceAll('"', '\\"');
  }

  async function resetCardsToToday(cardIds: number[]) {
    if (!cardIds.length) return { ok: true as const };

    for (const chunk of chunkArray(cardIds, 200)) {
      const dueRes = await ankiOperations.setDueDate({
        cards: chunk,
        days: "0",
      });
      if (!dueRes.ok) return { ok: false as const, error: dueRes.error };
    }

    for (const chunk of chunkArray(cardIds, 200)) {
      const forgetRes = await ankiOperations.forgetCards({
        cards: chunk,
      });
      if (!forgetRes.ok) return { ok: false as const, error: forgetRes.error };
    }

    return { ok: true as const };
  }

  async function pressKnownOnce(cardIds: number[]) {
    if (!cardIds.length) return { ok: true as const };

    for (const chunk of chunkArray(cardIds, 200)) {
      const res = await ankiOperations.answerCards({
        answers: chunk.map((cardId) => ({ cardId, ease: 3 as const })),
      });
      if (!res.ok) return { ok: false as const, error: res.error };
    }

    return { ok: true as const };
  }

  async function syncWithAnkiWebOrAlert(label: string) {
    if (
      typeof navigator !== "undefined" &&
      "onLine" in navigator &&
      !navigator.onLine
    ) {
      const msg = "اتصال اینترنت قطع است؛ سینک با AnkiWeb امکان‌پذیر نیست.";
      window.alert(msg);
      throw new Error(msg);
    }

    const res = await ankiSyncClient.sync();
    if (!res.ok) {
      const msg = `سینک با AnkiWeb ناموفق بود (${label}): ${res.error}`;
      window.alert(msg);
      throw new Error(msg);
    }
  }

  async function waitUntilFalse(
    runningRef: { current: boolean },
    timeoutMs = 10 * 60 * 1000,
  ) {
    const start = Date.now();
    while (runningRef.current) {
      if (Date.now() - start > timeoutMs)
        throw new Error("Timeout while waiting for phase to finish.");
      await new Promise((r) => setTimeout(r, 75));
    }
  }

  async function fetchSyncAllStatusAndUpdate() {
    const res = await fetch("/api/anki/hint-sentence/sync-all", {
      method: "GET",
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      status?: SyncAllStatus;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok || !data.status)
      throw new Error(data?.error || "Failed to fetch sync-all status");

    const status = data.status;
    setSyncAllRunning(Boolean(status.running));
    setSyncAllError(status.error);
    const remaining = Math.max(
      0,
      (status.total ?? 0) - (status.processed ?? 0),
    );
    setSyncAllStatusText(
      `done=${status.processed}/${status.total} remaining=${remaining} currentNoteId=${status.currentNoteId ?? "—"} updated=${status.updated} skipped=${status.skipped} failed=${status.failed} stopRequested=${status.stopRequested ? "yes" : "no"}`,
    );
    return status;
  }

  async function runAllPhases() {
    if (runAllRunning) return;
    if (phase0Running || phase1Running || phase2Running || phase3Running) return;

    setRunAllRunning(true);
    setRunAllError(null);
    setRunAllStatusText("Starting…");

    try {
      setRunAllStatusText("Syncing with AnkiWeb (before phase 0)…");
      await syncWithAnkiWebOrAlert("قبل از فاز ۰");

      setRunAllStatusText("Running phase 0…");
      await runPhase0();
      await new Promise((r) => setTimeout(r, 0));
      await waitUntilFalse(phase0RunningRef);
      if (phase0ErrorRef.current) {
        setRunAllError(`Phase 0 failed: ${phase0ErrorRef.current}`);
        return;
      }

      setRunAllStatusText("Syncing with AnkiWeb (after phase 0)…");
      await syncWithAnkiWebOrAlert("بعد از فاز ۰");

      setRunAllStatusText("Running phase 1…");
      await runPhase1();
      await new Promise((r) => setTimeout(r, 0));
      await waitUntilFalse(phase1RunningRef);
      if (phase1ErrorRef.current) {
        setRunAllError(`Phase 1 failed: ${phase1ErrorRef.current}`);
        return;
      }

      setRunAllStatusText("Syncing with AnkiWeb (after phase 1)…");
      await syncWithAnkiWebOrAlert("بعد از فاز ۱");

      setRunAllStatusText("Running phase 2…");
      await runPhase2();
      await new Promise((r) => setTimeout(r, 0));
      await waitUntilFalse(phase2RunningRef);
      if (phase2ErrorRef.current) {
        setRunAllError(`Phase 2 failed: ${phase2ErrorRef.current}`);
        return;
      }

      setRunAllStatusText("Syncing with AnkiWeb (after phase 2)…");
      await syncWithAnkiWebOrAlert("بعد از فاز ۲");

      setRunAllStatusText("Running phase 3…");
      await runPhase3();
      await new Promise((r) => setTimeout(r, 0));
      await waitUntilFalse(phase3RunningRef);
      if (phase3ErrorRef.current) {
        setRunAllError(`Phase 3 failed: ${phase3ErrorRef.current}`);
        return;
      }

      setRunAllStatusText("Syncing with AnkiWeb (after phase 3)…");
      await syncWithAnkiWebOrAlert("بعد از فاز ۳");

      setRunAllStatusText("Done.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunAllError(message);
    } finally {
      setRunAllRunning(false);
    }
  }

  async function getNoteIdsForCardIds(cardIds: number[]) {
    const noteIds = new Set<number>();
    for (const chunk of chunkArray(cardIds, 200)) {
      const infoRes = await ankiOperations.cardsInfo({ cards: chunk });
      if (!infoRes.ok) return { ok: false as const, error: infoRes.error };
      for (const card of infoRes.result ?? []) noteIds.add(card.note);
    }
    return { ok: true as const, noteIds: Array.from(noteIds) };
  }

  async function getNotesInfoByIds(noteIds: number[]) {
    const out: AnkiNotesInfo = [];
    for (const chunk of chunkArray(noteIds, 200)) {
      const infoRes = await ankiOperations.notesInfo({ notes: chunk });
      if (!infoRes.ok) return { ok: false as const, error: infoRes.error };
      if (infoRes.result) out.push(...infoRes.result);
    }
    return { ok: true as const, notesInfo: out };
  }

  async function getLastReviewsByCardId(cardIds: number[]) {
    const out = new Map<
      number,
      {
        id: number;
        ease: number;
        type: number;
        ivl: number;
        lastIvl: number;
        time: number;
      } | null
    >();
    for (const chunk of chunkArray(cardIds, 100)) {
      const reviewsRes = await ankiOperations.getReviewsOfCards({
        cards: chunk,
      });
      if (!reviewsRes.ok)
        return { ok: false as const, error: reviewsRes.error };

      const byCardId = reviewsRes.result ?? {};
      for (const cardId of chunk) {
        const reviews = byCardId[String(cardId)] ?? [];
        const last = reviews.reduce<(typeof reviews)[number] | null>(
          (best, r) => (best === null || r.id > best.id ? r : best),
          null,
        );
        out.set(cardId, last ?? null);
      }
    }
    return { ok: true as const, lastByCardId: out };
  }

  async function filterCardIdsWhereLastAnswerAgain(cardIds: number[]) {
    const lastRes = await getLastReviewsByCardId(cardIds);
    if (!lastRes.ok) return lastRes;
    const out: number[] = [];
    for (const cardId of cardIds) {
      const last = lastRes.lastByCardId.get(cardId) ?? null;
      if (last?.ease !== 1) continue;
      out.push(cardId);
    }
    return {
      ok: true as const,
      cardIds: out,
      lastByCardId: lastRes.lastByCardId,
    };
  }

  async function runPhase0() {
    if (phase0Running) return;

    setPhase0Running(true);
    setPhase0Error(null);
    setPhase0StatusText("Starting…");

    try {
      const enToFaDeck = WordAnkiConstants.decks.EnToFa;
      const faToEnDeck = WordAnkiConstants.decks.FaToEn;
      const tempDeck = WordAnkiConstants.decks.tempRoot;
      const rahnamaDeck = WordAnkiConstants.decks.Rahnama;

      setPhase0StatusText("Finding EnToFa/FaToEn cards…");
      const candidatesRes = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(enToFaDeck)}" OR deck:"${escapeAnkiQueryValue(faToEnDeck)}"`,
      });
      if (!candidatesRes.ok) {
        setPhase0Error(candidatesRes.error);
        return;
      }
      const candidateIds = candidatesRes.result ?? [];
      if (candidateIds.length === 0) {
        setPhase0StatusText("No cards found.");
        return;
      }

      const phase0FilterLabel = "Again";
      setPhase0StatusText(
        `Filtering last answer = ${phase0FilterLabel} for ${candidateIds.length} cards…`,
      );
      const againRes = await filterCardIdsWhereLastAnswerAgain(candidateIds);
      if (!againRes.ok) {
        setPhase0Error(againRes.error);
        return;
      }
      const againCardIds = againRes.cardIds;
      if (againCardIds.length === 0) {
        setPhase0StatusText("No cards matched the Phase 0 filter.");
        return;
      }

      appendPhaseLogIds(
        `فاز ۰: کارت‌های EnToFa/FaToEn با فیلتر «${phase0FilterLabel}» (cardIds)`,
        againCardIds,
      );

      setPhase0StatusText(`Moving ${againCardIds.length} cards to ${tempDeck}…`);
      const moveMainsRes = await ankiOperations.changeDeck({ cards: againCardIds, deck: tempDeck });
      if (!moveMainsRes.ok) {
        setPhase0Error(moveMainsRes.error);
        return;
      }

      setPhase0StatusText(`Finding noteIds for ${againCardIds.length} cards…`);
      const noteIdsRes = await getNoteIdsForCardIds(againCardIds);
      if (!noteIdsRes.ok) {
        setPhase0Error(noteIdsRes.error);
        return;
      }
      const noteIds = noteIdsRes.noteIds;
      if (noteIds.length === 0) {
        setPhase0StatusText("No related notes found (unexpected).");
        return;
      }

      setPhase0StatusText(`Finding Rahnama cards in ${tempDeck} for ${noteIds.length} notes…`);
      const rahnamaTempCardIds = new Set<number>();
      for (const noteId of noteIds) {
        const res = await ankiOperations.findCards({
          query: `nid:${noteId} deck:"${escapeAnkiQueryValue(tempDeck)}" card:"Rahnama"`,
        });
        if (!res.ok) {
          setPhase0Error(res.error);
          return;
        }
        for (const id of res.result ?? []) rahnamaTempCardIds.add(id);
      }

      const rahnamaIds = Array.from(rahnamaTempCardIds);
      if (!rahnamaIds.length) {
        setPhase0StatusText(`Done. Moved mains to ${tempDeck}. No Rahnama cards found in temp to activate.`);
        return;
      }

      appendPhaseLogIds(`فاز ۰: کارت‌های Rahnama که در ${tempDeck} بودند (cardIds)`, rahnamaIds);

      setPhase0StatusText(`Moving ${rahnamaIds.length} Rahnama cards to ${rahnamaDeck}…`);
      const moveRahnamaRes = await ankiOperations.changeDeck({ cards: rahnamaIds, deck: rahnamaDeck });
      if (!moveRahnamaRes.ok) {
        setPhase0Error(moveRahnamaRes.error);
        return;
      }

      setPhase0StatusText(`Resetting (due today + forget) ${rahnamaIds.length} Rahnama cards…`);
      const resetRes = await resetCardsToToday(rahnamaIds);
      if (!resetRes.ok) {
        setPhase0Error(resetRes.error);
        return;
      }

      setPhase0StatusText(`Done. Moved mains=${againCardIds.length} to ${tempDeck}. Activated+reset Rahnama=${rahnamaIds.length}.`);
    } finally {
      setPhase0Running(false);
    }
  }

  async function runPhase1() {
    if (phase1Running) return;

    setPhase1Running(true);
    setPhase1Error(null);
    setPhase1StatusText("Starting…");

    try {
      const sourceDeck = WordAnkiConstants.decks.Rahnama;
      const tempDeck = WordAnkiConstants.decks.tempRoot;
      const targetDeck = WordAnkiConstants.decks.Rahnama2;

      setPhase1StatusText(`Finding cards in ${sourceDeck}…`);
      const foundCardsRes = await findCardIdsInDeck(sourceDeck);
      if (!foundCardsRes.ok) {
        setPhase1Error(foundCardsRes.error);
        return;
      }

      const cardIds = foundCardsRes.value;
      if (cardIds.length === 0) {
        setPhase1StatusText("No matching cards found.");
        return;
      }

      appendPhaseLogIds(
        `فاز ۱: کارت‌های پیدا شده در ${sourceDeck} (cardIds)`,
        cardIds,
      );

      setPhase1StatusText(
        `Loading revlog (getReviewsOfCards, 100 per batch) for ${cardIds.length} cards…`,
      );
      const revlogRes = await getLastRevlogByCardIds(cardIds, 100);
      if (!revlogRes.ok) {
        setPhase1Error(revlogRes.error);
        return;
      }

      const intervalFiltered: number[] = [];
      for (const cardId of cardIds) {
        const last = revlogRes.value.get(cardId) ?? null;
        const interval = Number(last?.ivl);
        if (Number.isFinite(interval) && interval > 1)
          intervalFiltered.push(cardId);
      }

      if (intervalFiltered.length === 0) {
        setPhase1StatusText(
          "No Rahnama cards matched interval > 1 day (from revlog).",
        );
        return;
      }

      appendPhaseLogIds(
        `فاز ۱: کارت‌های Rahnama با interval>1 (از revlog) (cardIds)`,
        intervalFiltered,
      );

      setPhase1StatusText(
        `Moving ${intervalFiltered.length} cards to ${tempDeck}…`,
      );
      const moveToTempRes = await ankiOperations.changeDeck({ cards: intervalFiltered, deck: tempDeck });
      if (!moveToTempRes.ok) return void setPhase1Error(moveToTempRes.error);

      setPhase1StatusText(
        `Finding related notes for ${intervalFiltered.length} cards…`,
      );
      const noteIdsRes = await getNoteIdsForCardIds(intervalFiltered);
      if (!noteIdsRes.ok) {
        setPhase1Error(noteIdsRes.error);
        return;
      }
      const uniqueNoteIds = noteIdsRes.noteIds;
      if (uniqueNoteIds.length === 0) {
        setPhase1StatusText("No related notes found (unexpected).");
        return;
      }

      setPhase1StatusText(
        `Finding Rahnama2 cards for ${uniqueNoteIds.length} notes…`,
      );
      const rahnama2Ids = new Set<number>();
      for (const noteId of uniqueNoteIds) {
        const res = await ankiOperations.findCards({
          query: `nid:${noteId} card:"Rahnama2"`,
        });
        if (!res.ok) {
          setPhase1Error(res.error);
          return;
        }
        for (const id of res.result ?? []) rahnama2Ids.add(id);
      }

      const targetCardIds = Array.from(rahnama2Ids);
      if (!targetCardIds.length) {
        setPhase1StatusText("No Rahnama2 cards found for these notes (unexpected).");
        return;
      }

      appendPhaseLogIds("فاز ۱: کارت‌های Rahnama2 انتخاب‌شده (cardIds)", targetCardIds);

      setPhase1StatusText(`Moving ${targetCardIds.length} Rahnama2 cards to ${targetDeck}…`);
      const moveRes = await ankiOperations.changeDeck({ cards: targetCardIds, deck: targetDeck });
      if (!moveRes.ok) {
        setPhase1Error(moveRes.error);
        return;
      }

      setPhase1StatusText(`Resetting (due today + forget) ${targetCardIds.length} Rahnama2 cards…`);
      const resetRes = await resetCardsToToday(targetCardIds);
      if (!resetRes.ok) {
        setPhase1Error(resetRes.error);
        return;
      }

      setPhase1StatusText(
        `Done. Moved Rahnama(interval>1) to temp: ${intervalFiltered.length}. Notes: ${uniqueNoteIds.length}. Activated+reset Rahnama2: ${targetCardIds.length}.`,
      );
    } finally {
      setPhase1Running(false);
    }
  }

  async function runPhase2() {
    if (phase2Running) return;

    setPhase2Running(true);
    setPhase2Error(null);
    setPhase2StatusText("Starting…");

    try {
      const sourceDeck = WordAnkiConstants.decks.Rahnama2;
      const tempDeck = WordAnkiConstants.decks.tempRoot;
      const enToFaDeck = WordAnkiConstants.decks.EnToFa;
      const faToEnDeck = WordAnkiConstants.decks.FaToEn;

      setPhase2StatusText(`Finding cards in ${sourceDeck}…`);
      const foundCardsRes = await findCardIdsInDeck(sourceDeck);
      if (!foundCardsRes.ok) {
        setPhase2Error(foundCardsRes.error);
        return;
      }

      const cardIds = foundCardsRes.value;
      if (cardIds.length === 0) {
        setPhase2StatusText("No matching cards found.");
        return;
      }

      appendPhaseLogIds(`فاز ۲: کارت‌های پیدا شده در ${sourceDeck} (cardIds)`, cardIds);

      setPhase2StatusText(`Loading revlog (getReviewsOfCards, 100 per batch) for ${cardIds.length} cards…`);
      const revlogRes = await getLastRevlogByCardIds(cardIds, 100);
      if (!revlogRes.ok) {
        setPhase2Error(revlogRes.error);
        return;
      }

      const intervalFiltered: number[] = [];
      for (const cardId of cardIds) {
        const last = revlogRes.value.get(cardId) ?? null;
        const interval = Number(last?.ivl);
        if (Number.isFinite(interval) && interval > 1) intervalFiltered.push(cardId);
      }

      if (intervalFiltered.length === 0) {
        setPhase2StatusText("No Rahnama2 cards matched interval > 1 day (from revlog).");
        return;
      }

      appendPhaseLogIds(`فاز ۲: کارت‌های Rahnama2 با interval>1 (از revlog) (cardIds)`, intervalFiltered);

      setPhase2StatusText(`Moving ${intervalFiltered.length} cards to ${tempDeck}…`);
      const moveGuideRes = await ankiOperations.changeDeck({ cards: intervalFiltered, deck: tempDeck });
      if (!moveGuideRes.ok) {
        setPhase2Error(moveGuideRes.error);
        return;
      }

      setPhase2StatusText(`Finding related notes for ${intervalFiltered.length} cards…`);
      const noteIdsRes = await getNoteIdsForCardIds(intervalFiltered);
      if (!noteIdsRes.ok) {
        setPhase2Error(noteIdsRes.error);
        return;
      }
      const noteIds = noteIdsRes.noteIds;
      if (!noteIds.length) {
        setPhase2StatusText("No related notes found (unexpected).");
        return;
      }

      setPhase2StatusText(`Finding EnToFa/FaToEn cards in ${tempDeck} for ${noteIds.length} notes…`);
      const enToFaTemp = new Set<number>();
      const faToEnTemp = new Set<number>();
      for (const noteId of noteIds) {
        const enRes = await ankiOperations.findCards({
          query: `nid:${noteId} deck:"${escapeAnkiQueryValue(tempDeck)}" card:"EnToFa"`,
        });
        if (!enRes.ok) {
          setPhase2Error(enRes.error);
          return;
        }
        for (const id of enRes.result ?? []) enToFaTemp.add(id);

        const faRes = await ankiOperations.findCards({
          query: `nid:${noteId} deck:"${escapeAnkiQueryValue(tempDeck)}" card:"FaToEn"`,
        });
        if (!faRes.ok) {
          setPhase2Error(faRes.error);
          return;
        }
        for (const id of faRes.result ?? []) faToEnTemp.add(id);
      }

      const enToFaIds = Array.from(enToFaTemp);
      const faToEnIds = Array.from(faToEnTemp);
      if (!enToFaIds.length && !faToEnIds.length) {
        setPhase2StatusText(`Done. Moved Rahnama2(interval>1) to temp: ${intervalFiltered.length}. No mains found in temp to return.`);
        return;
      }

      if (enToFaIds.length) {
        appendPhaseLogIds(`فاز ۲: کارت‌های EnToFa که در ${tempDeck} بودند (cardIds)`, enToFaIds);
        const moveRes = await ankiOperations.changeDeck({ cards: enToFaIds, deck: enToFaDeck });
        if (!moveRes.ok) {
          setPhase2Error(moveRes.error);
          return;
        }
        const resetRes = await resetCardsToToday(enToFaIds);
        if (!resetRes.ok) {
          setPhase2Error(resetRes.error);
          return;
        }
      }

      if (faToEnIds.length) {
        appendPhaseLogIds(`فاز ۲: کارت‌های FaToEn که در ${tempDeck} بودند (cardIds)`, faToEnIds);
        const moveRes = await ankiOperations.changeDeck({ cards: faToEnIds, deck: faToEnDeck });
        if (!moveRes.ok) {
          setPhase2Error(moveRes.error);
          return;
        }
        const resetRes = await resetCardsToToday(faToEnIds);
        if (!resetRes.ok) {
          setPhase2Error(resetRes.error);
          return;
        }
      }

      const returnedCardIds = Array.from(new Set([...enToFaIds, ...faToEnIds]));
      if (returnedCardIds.length) {
        setPhase2StatusText(
          `Pressing “بلدم” once for ${returnedCardIds.length} returned cards…`,
        );
        const pressRes = await pressKnownOnce(returnedCardIds);
        if (!pressRes.ok) {
          setPhase2Error(pressRes.error);
          return;
        }
      }

      setPhase2StatusText(
        `Done. Moved Rahnama2(interval>1) to temp: ${intervalFiltered.length}. Returned+reset: EnToFa=${enToFaIds.length}, FaToEn=${faToEnIds.length}.`,
      );
    } finally {
      setPhase2Running(false);
    }
  }

  async function runPhase3() {
    if (phase3Running) return;

    setPhase3Running(true);
    setPhase3Error(null);
    setPhase3StatusText("Starting…");

    try {
      const desiredCount = Math.max(
        1,
        Math.min(100, Math.trunc(Number(sessionStudyCardCount) || 1)),
      );

      const enToFaDeck = WordAnkiConstants.decks.EnToFa;
      const faToEnDeck = WordAnkiConstants.decks.FaToEn;
      const emlaDeck = WordAnkiConstants.decks.Emla;
      const tempRootDeck = WordAnkiConstants.decks.tempRoot;

      setPhase3StatusText(
        `Counting available cards in ${enToFaDeck} (is:new OR is:due)…`,
      );
      const dueRes = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(enToFaDeck)}" (is:new OR is:due)`,
      });
      if (!dueRes.ok) {
        setPhase3Error(dueRes.error);
        return;
      }
      const availableNowCardIds = dueRes.result ?? [];
      const availableTotalCount = availableNowCardIds.length;

      if (availableTotalCount >= desiredCount) {
        setPhase3StatusText(
          `OK. Available = ${availableTotalCount} (>= ${desiredCount}).`,
        );
        return;
      }

      const needed = desiredCount - availableTotalCount;

      setPhase3StatusText(
        `Need ${needed} more note(s). Finding EnToFa cards in ${tempRootDeck}…`,
      );

      const tempCardRes = await ankiOperations.findCards({
        query: `deck:"${escapeAnkiQueryValue(tempRootDeck)}" card:"EnToFa"`,
      });
      if (!tempCardRes.ok) {
        setPhase3Error(tempCardRes.error);
        return;
      }

      const tempCardIds = tempCardRes.result ?? [];
      if (tempCardIds.length === 0) {
        setPhase3StatusText(`No EnToFa cards found in ${tempRootDeck}.`);
        return;
      }

      setPhase3StatusText(
        `Loading temp cards info to extract EnToFa notes… (${tempCardIds.length} cards)`,
      );
      const tempEnToFaNoteIdsSet = new Set<number>();
      for (const chunk of chunkArray(tempCardIds, 200)) {
        const cardsInfoRes = await ankiOperations.cardsInfo({
          cards: chunk,
        });
        if (!cardsInfoRes.ok) {
          setPhase3Error(cardsInfoRes.error);
          return;
        }

        for (const card of cardsInfoRes.result ?? []) {
          tempEnToFaNoteIdsSet.add(card.note);
        }
      }

      const tempNoteIds = Array.from(tempEnToFaNoteIdsSet);
      if (tempNoteIds.length === 0) {
        setPhase3StatusText(
          `No EnToFa notes found in ${tempRootDeck} (unexpected).`,
        );
        return;
      }

      setPhase3StatusText(
        `Loading note info (imageability / phonetic_us_normalized) for ${tempNoteIds.length} notes…`,
      );
      const infoRes = await getNotesInfoByIds(tempNoteIds);
      if (!infoRes.ok) {
        setPhase3Error(infoRes.error);
        return;
      }

      const candidates = infoRes.notesInfo
        .map((n) => {
          const imageability = asFiniteNumber(n.fields?.imageability?.value);
          const phoneticLen = phoneticLength(
            n.fields?.phonetic_us_normalized?.value,
          );
          return { noteId: n.noteId, imageability, phoneticLen };
        })
        .sort((a, b) => a.phoneticLen - b.phoneticLen || a.noteId - b.noteId);

      const pickedNoteIds: number[] = [];
      const pickedSet = new Set<number>();
      const tryPick = (noteId: number) => {
        if (pickedNoteIds.length >= needed) return;
        if (pickedSet.has(noteId)) return;
        pickedSet.add(noteId);
        pickedNoteIds.push(noteId);
      };

      // Step 1: Prefer imageability > threshold (how much above doesn't matter),
      // ordered by shortest `phonetic_us_normalized`.
      for (const c of candidates) {
        if (
          (c.imageability ?? Number.NEGATIVE_INFINITY) >
          imageabilityBaseThreshold
        ) {
          tryPick(c.noteId);
        }
        if (pickedNoteIds.length >= needed) break;
      }
      // Step 2: Fill remaining by shortest `phonetic_us_normalized`.
      if (pickedNoteIds.length < needed) {
        for (const c of candidates) {
          tryPick(c.noteId);
          if (pickedNoteIds.length >= needed) break;
        }
      }
      for (const noteId of pickedNoteIds) {
        const notesInfoRes = await getNotesInfoByIds([noteId]);
        if (notesInfoRes.ok) {
          console.log(
            `[AnkiNotePage.client.tsx] Note ${noteId}:`,
            notesInfoRes.notesInfo[0],
          );
        }
      }
      if (pickedNoteIds.length === 0) {
        setPhase3StatusText(
          "No candidate notes found (missing phonetic_us_normalized?).",
        );
        return;
      }

      setPhase3StatusText(
        `Selecting cards from ${pickedNoteIds.length} note(s)…`,
      );
      const candidateEnToFa = new Set<number>();
      const candidateFaToEn = new Set<number>();
      const candidateEmla = new Set<number>();

      for (const noteId of pickedNoteIds) {
        const enRes = await ankiOperations.findCards({
          query: `nid:${noteId} card:"EnToFa"`,
        });
        if (!enRes.ok) {
          setPhase3Error(enRes.error);
          return;
        }
        for (const id of enRes.result ?? []) candidateEnToFa.add(id);

        const faRes = await ankiOperations.findCards({
          query: `nid:${noteId} card:"FaToEn"`,
        });
        if (!faRes.ok) {
          setPhase3Error(faRes.error);
          return;
        }
        for (const id of faRes.result ?? []) candidateFaToEn.add(id);

        const emRes = await ankiOperations.findCards({
          query: `nid:${noteId} card:"Emla"`,
        });
        if (!emRes.ok) {
          setPhase3Error(emRes.error);
          return;
        }
        for (const id of emRes.result ?? []) candidateEmla.add(id);
      }

      const candidateEnToFaIds = Array.from(candidateEnToFa);
      const candidateFaToEnIds = Array.from(candidateFaToEn);
      const candidateEmlaIds = Array.from(candidateEmla);

      if (
        candidateEnToFaIds.length === 0 &&
        candidateFaToEnIds.length === 0 &&
        candidateEmlaIds.length === 0
      ) {
        setPhase3StatusText(
          "No EnToFa/FaToEn/Emla cards found for selected notes.",
        );
        return;
      }

      const moveEnToFa = candidateEnToFaIds;
      const moveFaToEn = candidateFaToEnIds;
      const moveEmla = candidateEmlaIds;

      setPhase3StatusText("Moving cards to target decks…");
      if (moveEnToFa.length) {
        for (const chunk of chunkArray(moveEnToFa, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: enToFaDeck,
          });
          if (!res.ok) {
            setPhase3Error(res.error);
            return;
          }
        }
      }
      if (moveFaToEn.length) {
        for (const chunk of chunkArray(moveFaToEn, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: faToEnDeck,
          });
          if (!res.ok) {
            setPhase3Error(res.error);
            return;
          }
        }
      }
      if (moveEmla.length) {
        for (const chunk of chunkArray(moveEmla, 200)) {
          const res = await ankiOperations.changeDeck({
            cards: chunk,
            deck: emlaDeck,
          });
          if (!res.ok) {
            setPhase3Error(res.error);
            return;
          }
        }
      }

      setPhase3StatusText(
        `Done. Available(before)=${availableTotalCount}/${desiredCount}. Picked notes: ${pickedNoteIds.length}. Requested moves: EnToFa=${moveEnToFa.length}, FaToEn=${moveFaToEn.length}, Emla=${moveEmla.length}.`,
      );
    } finally {
      setPhase3Running(false);
    }
  }

  async function handleSearch() {
    setIsLoading(true);
    setError(null);
    setNotesInfo(null);
    setOpenNoteIds({});

    try {
      if (!ankiLinkId.trim()) {
        setError("Please enter `anki_link_id`.");
        return;
      }

      let noteIds: number[] | null = null;
      for (const query of queries) {
        const noteIdsRes = await ankiOperations.findNotes({ query });
        noteIds = noteIdsRes.ok ? noteIdsRes.result : null;
        if (noteIds && noteIds.length > 0) break;
      }

      if (!noteIds || noteIds.length === 0) {
        setError("No notes found for this `anki_link_id`.");
        return;
      }

      const infoRes = await ankiOperations.notesInfo({ notes: noteIds });
      if (!infoRes.ok || !infoRes.result) {
        setError("Failed to read note info from AnkiConnect.");
        return;
      }

      setNotesInfo(infoRes.result);
    } finally {
      setIsLoading(false);
    }
  }

  async function browseMainNotes() {
    setIsLoading(true);
    setError(null);
    setNotesInfo(null);
    setOpenNoteIds({});
    setUpdatingNoteIds({});
    setUpdateErrors({});

    try {
      const modelName = AnkiNoteTypes.META_LEX_VR9;
      const limit = Math.max(
        1,
        Math.min(500, Math.trunc(Number(browseLimit) || 50)),
      );
      const extra = browseQueryExtra.trim();
      const query = [`note:"${modelName.replaceAll('"', '\\"')}"`, extra]
        .filter(Boolean)
        .join(" ");

      const idsRes = await ankiOperations.findNotes({ query });
      if (!idsRes.ok) {
        setError(idsRes.error);
        return;
      }

      const ids = idsRes.result ?? [];
      if (ids.length === 0) {
        setError(`No notes found for model ${modelName}.`);
        return;
      }

      const sliced = ids.length > limit ? ids.slice(-limit) : ids;
      const infoRes = await ankiOperations.notesInfo({ notes: sliced });
      if (!infoRes.ok) {
        setError(infoRes.error);
        return;
      }
      if (!infoRes.result) {
        setError("Empty result from AnkiConnect (notesInfo).");
        return;
      }

      setNotesInfo(infoRes.result);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateHintSentence(noteId: number) {
    if (updatingNoteIds[noteId]) return;

    setUpdatingNoteIds((p) => ({ ...p, [noteId]: true }));
    setUpdateErrors((p) => ({ ...p, [noteId]: null }));

    try {
      const res = await fetch("/api/anki/hint-sentence/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        note?: AnkiNotesInfo[number];
        error?: string;
      } | null;
      if (!res.ok || !data?.ok || !data.note) {
        setUpdateErrors((p) => ({
          ...p,
          [noteId]: data?.error || `Request failed (${res.status})`,
        }));
        return;
      }
      const updated = data.note;

      setNotesInfo((prev) => {
        if (!prev) return prev;
        return prev.map((n) => (n.noteId === noteId ? updated : n));
      });
    } finally {
      setUpdatingNoteIds((p) => ({ ...p, [noteId]: false }));
    }
  }

  async function pollSyncAll() {
    await fetchSyncAllStatusAndUpdate();
  }

  async function startSyncAll() {
    setSyncAllError(null);
    setSyncAllStatusText(null);
    setSyncAllRunning(true);
    try {
      const res = await fetch("/api/anki/hint-sentence/sync-all", {
        method: "POST",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || `Request failed (${res.status})`);
      await pollSyncAll();
    } catch (e) {
      setSyncAllError(e instanceof Error ? e.message : String(e));
      setSyncAllRunning(false);
    }
  }

  async function requestStopSyncAll() {
    try {
      const res = await fetch("/api/anki/hint-sentence/sync-all", {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok)
        throw new Error(data?.error || `Request failed (${res.status})`);
      await pollSyncAll();
    } catch (e) {
      setSyncAllError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    if (!syncAllRunning) return;
    const t = setInterval(() => {
      void pollSyncAll().catch(() => null);
    }, 1000);
    return () => clearInterval(t);
  }, [syncAllRunning]);

  useEffect(() => {
    if (phase0StatusText) appendPhaseLog(`فاز ۰: ${phase0StatusText}`);
  }, [phase0StatusText]);

  useEffect(() => {
    if (phase0Error) appendPhaseLog(`فاز ۰ (خطا): ${phase0Error}`);
  }, [phase0Error]);

  useEffect(() => {
    if (phase1StatusText) appendPhaseLog(`فاز ۱: ${phase1StatusText}`);
  }, [phase1StatusText]);

  useEffect(() => {
    if (phase1Error) appendPhaseLog(`فاز ۱ (خطا): ${phase1Error}`);
  }, [phase1Error]);

  useEffect(() => {
    if (phase2StatusText) appendPhaseLog(`فاز ۲: ${phase2StatusText}`);
  }, [phase2StatusText]);

  useEffect(() => {
    if (phase2Error) appendPhaseLog(`فاز ۲ (خطا): ${phase2Error}`);
  }, [phase2Error]);

  useEffect(() => {
    if (phase3StatusText) appendPhaseLog(`فاز ۳: ${phase3StatusText}`);
  }, [phase3StatusText]);

  useEffect(() => {
    if (phase3Error) appendPhaseLog(`فاز ۳ (خطا): ${phase3Error}`);
  }, [phase3Error]);

  useEffect(() => {
    const el = phaseLogBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [phaseLogs.length]);

  async function openFieldsModal() {
    setFieldsModalOpen(true);
    setModelError(null);
    setModelFields(null);
    await fetchModelFields();
  }

  async function fetchModelFields() {
    setModelError(null);
    setModelFields(null);
    setModelBusy(true);
    try {
      const fieldsRes = await ankiOperations.modelFieldNames({
        modelName: AnkiNoteTypes.META_LEX_VR9,
      });
      if (!fieldsRes.ok) {
        setModelError(fieldsRes.error);
        return;
      }
      if (!fieldsRes.result) {
        setModelError("Empty result from AnkiConnect (modelFieldNames).");
        return;
      }
      setModelFields(fieldsRes.result);
    } finally {
      setModelBusy(false);
    }
  }

  async function ensureHintSentenceField() {
    setModelError(null);
    setModelBusy(true);
    try {
      const fieldsRes = await ankiOperations.modelFieldNames({
        modelName: AnkiNoteTypes.META_LEX_VR9,
      });
      if (!fieldsRes.ok) {
        setModelError(fieldsRes.error);
        return;
      }
      const fields = fieldsRes.result;
      if (!fields) {
        setModelError("Empty result from AnkiConnect (modelFieldNames).");
        return;
      }

      if (fields.includes("hint_sentence")) {
        setModelFields(fields);
        return;
      }

      const addRes = await ankiOperations.modelFieldAdd({
        modelName: AnkiNoteTypes.META_LEX_VR9,
        fieldName: "hint_sentence",
      });
      if (!addRes.ok) {
        setModelError(addRes.error);
        return;
      }
      if (addRes.result === null) {
        setModelError(
          "modelFieldAdd returned null (check AnkiConnect permissions and model state).",
        );
        return;
      }

      await fetchModelFields();
    } finally {
      setModelBusy(false);
    }
  }

  async function runBaseFormLookup() {
    setBaseFormLookupLoading(true);
    setBaseFormLookupError(null);
    try {
      const parsed = JSON.parse(baseFormLookupJson) as unknown;
      const normalized = normalizeBaseFormLookupInput(parsed);

      const res = await fetch("/api/anki-note/base-form-note-ids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(normalized.items),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; noteIds?: string[] }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const noteIds = data.noteIds ?? [];
      setBaseFormLookupNoteIds(noteIds);
      setBaseFormLookupLog(JSON.stringify(noteIds, null, 2));
      setBaseFormLookupInputStatus(
        `${normalized.sourceLabel} -> ${noteIds.length} anki_link_id`,
      );
    } catch (e) {
      setBaseFormLookupError(e instanceof Error ? e.message : String(e));
      setBaseFormLookupNoteIds([]);
      setBaseFormLookupLog("[]");
      setBaseFormLookupInputStatus(null);
    } finally {
      setBaseFormLookupLoading(false);
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
    } catch (e) {
      setBaseFormLookupError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addAnkiLinkIdsToStudyQueue(
    inputAnkiLinkIds: string[],
    setStatus: (value: string | null) => void,
  ) {
    const uniqueAnkiLinkIds = Array.from(
      new Set(inputAnkiLinkIds.map((item) => item.trim()).filter(Boolean)),
    );
    if (uniqueAnkiLinkIds.length === 0) {
      setStatus("موردی برای انتقال انتخاب نشده است.");
      return;
    }

    setStatus("گسترش ساختار درختی بر اساس anki_link_id…");
    const lookupRes = await fetch("/api/anki-note/base-form-note-ids", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        uniqueAnkiLinkIds.map((anki_link_id) => ({
          anki_link_id,
        })),
      ),
    });
    const lookupData = (await lookupRes.json().catch(() => null)) as
      | { ok?: boolean; error?: string; noteIds?: string[] }
      | null;
    if (!lookupRes.ok || !lookupData?.ok) {
      throw new Error(lookupData?.error || `Request failed (${lookupRes.status})`);
    }

    const expandedAnkiLinkIds = Array.from(
      new Set((lookupData.noteIds ?? []).map((item) => item.trim()).filter(Boolean)),
    );
    if (expandedAnkiLinkIds.length === 0) {
      setStatus("هیچ anki_link_id معتبری برای انتقال پیدا نشد.");
      return;
    }

    setStatus("Finding Anki notes by anki_link_id…");

    const ankiNoteIdsSet = new Set<number>();
    for (const ankiLinkId of expandedAnkiLinkIds) {
      const queries = buildQueries(ankiLinkId);
      let matchedNoteIds: number[] = [];

      for (const query of queries) {
        const res = await ankiOperations.findNotes({ query });
        if (!res.ok) throw new Error(res.error);
        matchedNoteIds = res.result ?? [];
        if (matchedNoteIds.length > 0) break;
      }

      for (const noteId of matchedNoteIds) {
        ankiNoteIdsSet.add(noteId);
      }
    }

    const ankiNoteIds = Array.from(ankiNoteIdsSet);
    if (ankiNoteIds.length === 0) {
      setStatus("No Anki notes found for extracted anki_link_id values.");
      return;
    }

    setStatus(`Selecting cards from ${ankiNoteIds.length} note(s)…`);

    const candidateEnToFa = new Set<number>();
    const candidateFaToEn = new Set<number>();
    const candidateEmla = new Set<number>();

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

      const emlaRes = await ankiOperations.findCards({
        query: `nid:${noteId} card:"Emla"`,
      });
      if (!emlaRes.ok) throw new Error(emlaRes.error);
      for (const id of emlaRes.result ?? []) candidateEmla.add(id);
    }

    const moveEnToFa = Array.from(candidateEnToFa);
    const moveFaToEn = Array.from(candidateFaToEn);
    const moveEmla = Array.from(candidateEmla);

    if (
      moveEnToFa.length === 0 &&
      moveFaToEn.length === 0 &&
      moveEmla.length === 0
    ) {
      setStatus("No EnToFa/FaToEn/Emla cards found for extracted notes.");
      return;
    }

    setStatus("Moving cards to target decks…");

    if (moveEnToFa.length) {
      for (const chunk of chunkArray(moveEnToFa, 200)) {
        const res = await ankiOperations.changeDeck({
          cards: chunk,
          deck: WordAnkiConstants.decks.EnToFa,
        });
        if (!res.ok) throw new Error(res.error);
      }
    }

    if (moveFaToEn.length) {
      for (const chunk of chunkArray(moveFaToEn, 200)) {
        const res = await ankiOperations.changeDeck({
          cards: chunk,
          deck: WordAnkiConstants.decks.FaToEn,
        });
        if (!res.ok) throw new Error(res.error);
      }
    }

    if (moveEmla.length) {
      for (const chunk of chunkArray(moveEmla, 200)) {
        const res = await ankiOperations.changeDeck({
          cards: chunk,
          deck: WordAnkiConstants.decks.Emla,
        });
        if (!res.ok) throw new Error(res.error);
      }
    }

    setStatus(
      `Done. Notes=${ankiNoteIds.length}. Moves: EnToFa=${moveEnToFa.length}, FaToEn=${moveFaToEn.length}, Emla=${moveEmla.length}.`,
    );
  }

  async function addLookupNotesToStudyQueue() {
    if (baseFormQueueLoading) return;
    if (baseFormLookupNoteIds.length === 0) {
      setBaseFormQueueStatus("ابتدا آرایه note را بساز.");
      return;
    }

    setBaseFormQueueLoading(true);
    setBaseFormLookupError(null);
    setBaseFormQueueStatus(null);

    try {
      await addAnkiLinkIdsToStudyQueue(baseFormLookupNoteIds, setBaseFormQueueStatus);
    } catch (e) {
      setBaseFormLookupError(e instanceof Error ? e.message : String(e));
      setBaseFormQueueStatus(null);
    } finally {
      setBaseFormQueueLoading(false);
    }
  }

  async function searchStudyCandidates() {
    setStudyCandidatesLoading(true);
    setStudyCandidatesError(null);
    setStudyCandidatesStatus("جستجو در دیتابیس و بررسی وضعیت نوت‌ها در Anki…");
    setStudyCandidates([]);

    try {
      const url = new URL("/api/anki-note/study-candidate-notes", window.location.origin);
      if (studyCandidatesQuery.trim()) {
        url.searchParams.set("q", studyCandidatesQuery.trim());
      }
      url.searchParams.set("limit", "60");

      const res = await fetch(url.toString());
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: StudyCandidateRow[] }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const dbItems = data.items ?? [];
      const resolvedRows = await resolveEligibleStudyCandidateRows(dbItems);

      setStudyCandidates(resolvedRows);
      setStudyCandidatesStatus(
        resolvedRows.length
          ? `${resolvedRows.length} نوت آماده‌ی انتخاب پیدا شد.`
          : "نتیجه‌ای پیدا نشد.",
      );
    } catch (e) {
      setStudyCandidatesError(e instanceof Error ? e.message : String(e));
      setStudyCandidatesStatus(null);
    } finally {
      setStudyCandidatesLoading(false);
    }
  }

  async function resolveEligibleStudyCandidateRows(
    dbItems: StudyCandidateRow[],
    desiredCount?: number,
  ) {
    const resolvedRows: StudyCandidateResolvedRow[] = [];

    for (const item of dbItems) {
      const queries = buildQueries(item.anki_link_id);
      let matchedNoteIds: number[] = [];

      for (const query of queries) {
        const noteRes = await ankiOperations.findNotes({ query });
        if (!noteRes.ok) throw new Error(noteRes.error);
        matchedNoteIds = noteRes.result ?? [];
        if (matchedNoteIds.length > 0) break;
      }
      if (matchedNoteIds.length === 0) continue;

      for (const noteId of matchedNoteIds) {
        const noteInfoRes = await ankiOperations.notesInfo({
          notes: [noteId],
        });
        if (!noteInfoRes.ok) throw new Error(noteInfoRes.error);
        const noteInfo = noteInfoRes.result?.[0];
        if (noteInfo?.modelName !== AnkiNoteTypes.META_LEX_VR9) {
          continue;
        }

        const cardIdsRes = await ankiOperations.findCards({
          query: `nid:${noteId}`,
        });
        if (!cardIdsRes.ok) throw new Error(cardIdsRes.error);
        const cardIds = cardIdsRes.result ?? [];
        if (cardIds.length === 0) continue;

        const cardsInfoRes = await ankiOperations.cardsInfo({
          cards: cardIds,
        });
        if (!cardsInfoRes.ok) throw new Error(cardsInfoRes.error);
        const cardsInfo = cardsInfoRes.result ?? [];
        const hasAnyStudyDeckCard = cardsInfo.some(
          (card) =>
            card.deckName === WordAnkiConstants.decks.EnToFa ||
            card.deckName === WordAnkiConstants.decks.FaToEn ||
            card.deckName === WordAnkiConstants.decks.Emla,
        );
        if (hasAnyStudyDeckCard) continue;

        resolvedRows.push({
          ...item,
          noteId,
        });
        break;
      }

      if (desiredCount != null && resolvedRows.length >= desiredCount) {
        break;
      }
    }

    return resolvedRows;
  }

  async function addTopLearningDepthNotesToStudyQueue() {
    if (topLearningDepthLoading) return;
    const desiredCount = Math.max(1, Math.min(100, Math.trunc(topLearningDepthCount) || 10));

    setTopLearningDepthLoading(true);
    setTopLearningDepthStatus("در حال پیدا کردن نوت‌های با learning_depth بالاتر…");
    setStudyCandidatesError(null);

    try {
      const url = new URL("/api/anki-note/study-candidate-notes", window.location.origin);
      url.searchParams.set("mode", "top-learning-depth");

      const res = await fetch(url.toString());
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: StudyCandidateRow[] }
        | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const resolvedRows = await resolveEligibleStudyCandidateRows(
        data.items ?? [],
        desiredCount,
      );
      if (resolvedRows.length === 0) {
        setTopLearningDepthStatus("هیچ نوت واجد شرایطی پیدا نشد.");
        return;
      }

      setTopLearningDepthStatus(
        `${desiredCount} نوت برتر پیدا شد (${resolvedRows.length}). در حال اعمال ساختار درختی…`,
      );
      await addAnkiLinkIdsToStudyQueue(
        resolvedRows.map((row) => row.anki_link_id),
        setTopLearningDepthStatus,
      );
    } catch (e) {
      setStudyCandidatesError(e instanceof Error ? e.message : String(e));
      setTopLearningDepthStatus(null);
    } finally {
      setTopLearningDepthLoading(false);
    }
  }

  function toggleStudyCandidate(row: StudyCandidateResolvedRow, checked: boolean) {
    setSelectedStudyCandidateIds((prev) => {
      if (checked) {
        return { ...prev, [row.anki_link_id]: row };
      }
      const next = { ...prev };
      delete next[row.anki_link_id];
      return next;
    });
  }

  async function applySelectedStudyCandidates() {
    if (studyCandidatesApplyLoading) return;
    const selectedRows = Object.values(selectedStudyCandidateIds);
    if (selectedRows.length === 0) {
      setStudyCandidatesApplyStatus("حداقل یک رکورد را انتخاب کن.");
      return;
    }

    setStudyCandidatesApplyLoading(true);
    setStudyCandidatesError(null);
    setStudyCandidatesApplyStatus(null);

    try {
      await addAnkiLinkIdsToStudyQueue(
        selectedRows.map((row) => row.anki_link_id),
        setStudyCandidatesApplyStatus,
      );
    } catch (e) {
      setStudyCandidatesError(e instanceof Error ? e.message : String(e));
      setStudyCandidatesApplyStatus(null);
    } finally {
      setStudyCandidatesApplyLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Card Management"
        subtitle="AnkiConnect must be running (port 8765). Searches by `anki_link_id` (or `AnkiLinkId`)."
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setBaseFormLookupModalOpen(true);
            setBaseFormQueueStatus(null);
          }}
          className="rounded-xl border border-card bg-card px-4 py-2 text-sm text-foreground shadow-elevated transition hover:bg-accent"
        >
          افزودن آرایه کلمات به صف مطالعه
        </button>
        <button
          type="button"
          onClick={() => {
            setStudyCandidatesModalOpen(true);
            setStudyCandidatesError(null);
            setStudyCandidatesStatus(null);
            setStudyCandidatesApplyStatus(null);
            setSelectedStudyCandidateIds({});
          }}
          className="rounded-xl border border-card bg-card px-4 py-2 text-sm text-foreground shadow-elevated transition hover:bg-accent"
        >
          افزودن نوت‌های {AnkiNoteTypes.META_LEX_VR9} به صف مطالعه
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={topLearningDepthCount}
            onChange={(e) =>
              setTopLearningDepthCount(
                Math.max(1, Math.min(100, Math.trunc(Number(e.target.value) || 1))),
              )
            }
            className="w-20 rounded-xl border border-card bg-background px-3 py-2 text-sm text-foreground shadow-elevated outline-none transition focus:border-foreground/30"
          />
          <button
            type="button"
            onClick={() => void addTopLearningDepthNotesToStudyQueue()}
            disabled={topLearningDepthLoading}
            className="rounded-xl border border-card bg-card px-4 py-2 text-sm text-foreground shadow-elevated transition hover:bg-accent disabled:opacity-60"
          >
            {topLearningDepthLoading
              ? "در حال انتخاب..."
              : "افزودن ۱۰ نوت با learning_depth بالاتر"}
          </button>
        </div>
        {topLearningDepthStatus ? (
          <div className="flex items-center text-xs text-muted">
            {topLearningDepthStatus}
          </div>
        ) : null}
      </div>

      <div
        dir="rtl"
        className="rounded-2xl border border-card bg-card p-5 text-right shadow-elevated"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">فازها</div>
	            <div className="mt-1 text-xs text-muted">
	              این کادر برای اجرای چند فازِ گردش کارت‌ها بین deckها است.
	            </div>
	          </div>

          <div className="w-full sm:w-[160px]">
            <div className="mb-1 text-xs font-semibold text-muted">
              تعداد کارت ها برای مطالعه جلسه
            </div>
            <select
              value={String(sessionStudyCardCount)}
              onChange={(e) =>
                setSessionStudyCardCount(
                  Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                )
              }
              className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {numberOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <div className="mb-1 text-xs font-semibold text-muted">
              اجرای خودکار
            </div>
            <label className="mb-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={phaseActionsEnabled}
                onChange={(e) => setPhaseActionsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border border-card"
              />
              فعال شدن دکمه‌های فاز ۰، ۱، ۲ و اجرای کامل
            </label>
	            <button
	              type="button"
	              onClick={() => void runAllPhases()}
	              disabled={
	                !phaseActionsEnabled ||
	                runAllRunning ||
	                phase0Running ||
	                phase1Running ||
	                phase2Running ||
	                phase3Running
	              }
	              className="h-11 w-full rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60 sm:w-auto"
	            >
	              {runAllRunning ? "در حال انجام..." : "اجرای فاز ۰ تا ۳"}
	            </button>
            {runAllStatusText ? (
              <div className="mt-1 text-xs text-foreground/80">
                {runAllStatusText}
              </div>
            ) : null}
            {runAllError ? (
              <div className="mt-1 text-xs text-red-700">{runAllError}</div>
            ) : null}
          </div>
        </div>

	        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
	          {Array.from({ length: phaseCount }, (_, idx) => {
	            const phaseNumber = idx;
	            return (
	              <div
	                key={phaseNumber}
	                className="rounded-xl border border-card bg-background p-3"
	              >
	                <div className="text-sm font-semibold text-foreground">
	                  فاز {phaseNumber}
	                  <span className="ms-2 text-xs font-semibold text-muted">
	                    {phaseNumber === 0
	                      ? "شروع / قرنطینه"
	                      : phaseNumber === 1
	                        ? "Rahnama → Rahnama2"
	                        : phaseNumber === 2
	                          ? "بازگشت کارت‌های اصلی"
	                          : phaseNumber === 3
	                            ? "افزودن کارت"
	                            : ""}
	                  </span>
	                </div>
	                {phaseNumber === 0 ? (
	                  <div className="mt-2 grid gap-3">
	                    <button
	                      type="button"
	                      onClick={() => void runPhase0()}
	                      disabled={!phaseActionsEnabled || phase0Running}
	                      className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
	                    >
	                      {phase0Running ? "در حال انجام..." : "اجرای فاز ۰"}
	                    </button>

   	                <div dir="rtl" className="grid gap-2 text-right">
	                      <ol className="list-decimal space-y-1 ps-5 text-xs text-muted">
	                        <li>
	                          کارت‌های deck های {WordAnkiConstants.decks.EnToFa} و{" "}
	                          {WordAnkiConstants.decks.FaToEn} پیدا می‌شوند.
	                        </li>
	                        <li>
	                          از بین آن‌ها کارت‌هایی که آخرین پاسخشان{" "}
	                          <span className="font-mono text-xs">Again</span> بوده
	                          انتخاب می‌شوند.
	                        </li>
	                        <li>
	                          برای جلوگیری از این‌که کارت‌هایی که فاز ۲ به deckهای
	                          اصلی برمی‌گرداند (اما آخرین پاسخشان هنوز Again است)
	                          دوباره در فاز ۰ انتخاب شوند، در فاز ۲ بعد از ریست
	                          یک بار هم «بلدم» زده می‌شود تا آخرین پاسخشان Again
	                          نباشد.
	                        </li>
	                        <li>
	                          آن کارت‌ها به deck {WordAnkiConstants.decks.tempRoot}{" "}
	                          منتقل می‌شوند (برای جلوگیری از تداخل).
	                        </li>
	                        <li>
	                          برای نوت‌های معادل، کارت{" "}
	                          <span className="font-mono text-xs">card:&quot;Rahnama&quot;</span>{" "}
	                          که در {WordAnkiConstants.decks.tempRoot} باشد پیدا می‌شود.
	                        </li>
	                        <li>
	                          کارت‌های Rahnama پیدا‌شده به deck{" "}
	                          {WordAnkiConstants.decks.Rahnama} منتقل می‌شوند و ریست
	                          می‌شوند (due=today سپس forget).
	                        </li>
	                      </ol>

	                      {phase0StatusText ? (
	                        <div className="text-xs text-foreground/80">
	                          {phase0StatusText}
	                        </div>
	                      ) : null}
	                      {phase0Error ? (
	                        <div className="text-xs text-red-700">
	                          {phase0Error}
	                        </div>
	                      ) : null}
	                    </div>
	                  </div>
	                ) : phaseNumber === 1 ? (
	                  <div className="mt-2 grid gap-3">
	                    <button
	                      type="button"
	                      onClick={() => void runPhase1()}
                      disabled={!phaseActionsEnabled || phase1Running}
                      className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                    >
                      {phase1Running ? "در حال انجام..." : "اجرای فاز ۱"}
                    </button>

	                    <div dir="rtl" className="grid gap-2 text-right">
	                      <ol className="list-decimal space-y-1 ps-5 text-xs text-muted">
	                        <li>
	                          آیدی کارت‌های deck {WordAnkiConstants.decks.Rahnama}{" "}
	                          پیدا می‌شود.
	                        </li>
	                        <li>
	                          از روی revlog (آخرین ivl) فقط کارت‌های Rahnama با
	                          interval&gt;1 جدا می‌شوند.
	                        </li>
	                        <li>
	                          آن کارت‌ها به deck {WordAnkiConstants.decks.tempRoot}{" "}
	                          منتقل می‌شوند.
	                        </li>
	                        <li>نوت‌های معادلِ آن کارت‌ها پیدا می‌شوند.</li>
	                        <li>
	                          از همان نوت‌ها کارت{" "}
	                          <span className="font-mono text-xs">
	                            card:&quot;Rahnama2&quot;
	                          </span>{" "}
	                          پیدا می‌شود.
	                        </li>
	                        <li>
	                          کارت Rahnama2 به deck{" "}
	                          {WordAnkiConstants.decks.Rahnama2} منتقل می‌شود و ریست
	                          می‌شود (due=today سپس forget).
	                        </li>
	                      </ol>

                      {phase1StatusText ? (
                        <div className="text-xs text-foreground/80">
                          {phase1StatusText}
                        </div>
                      ) : null}
                      {phase1Error ? (
                        <div className="text-xs text-red-700">
                          {phase1Error}
                        </div>
                      ) : null}
	                    </div>
	                  </div>
	                ) : phaseNumber === 2 ? (
	                  <div className="mt-2 grid gap-3">
                    <button
                      type="button"
                      onClick={() => void runPhase2()}
                      disabled={!phaseActionsEnabled || phase2Running}
                      className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                    >
                      {phase2Running ? "در حال انجام..." : "اجرای فاز ۲"}
                    </button>

	                    <div dir="rtl" className="grid gap-2 text-right">
	                      <ol className="list-decimal space-y-1 ps-5 text-xs text-muted">
	                        <li>
	                          آیدی کارت‌های deck {WordAnkiConstants.decks.Rahnama2}{" "}
	                          پیدا می‌شود.
	                        </li>
	                        <li>
	                          از روی revlog (آخرین ivl) فقط کارت‌های Rahnama2 با
	                          interval&gt;1 جدا می‌شوند.
	                        </li>
	                        <li>
	                          آن کارت‌ها به deck {WordAnkiConstants.decks.tempRoot}{" "}
	                          منتقل می‌شوند.
	                        </li>
	                        <li>
	                          برای نوت‌های معادل، اگر کارت‌های{" "}
	                          {WordAnkiConstants.decks.EnToFa} /{" "}
	                          {WordAnkiConstants.decks.FaToEn} در{" "}
	                          {WordAnkiConstants.decks.tempRoot} باشند پیدا می‌شوند.
	                        </li>
	                        <li>
	                          کارت‌های پیدا‌شده به deckهای اصلی‌شان برگردانده می‌شوند
	                          و ریست می‌شوند (due=today سپس forget)، و سپس یک بار هم
	                          «بلدم» زده می‌شود تا آخرین پاسخشان Again نباشد.
	                        </li>
	                      </ol>

                      {phase2StatusText ? (
                        <div className="text-xs text-foreground/80">
                          {phase2StatusText}
                        </div>
                      ) : null}
                      {phase2Error ? (
                        <div className="text-xs text-red-700">
                          {phase2Error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : phaseNumber === 3 ? (
                  <div className="mt-2 grid gap-3">
                    <button
                      type="button"
                      onClick={() => void runPhase3()}
                      disabled={phase3Running}
                      className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                    >
                      {phase3Running ? "در حال انجام..." : "اجرای فاز ۳"}
                    </button>

                    <div className="grid gap-2">
                      <ol className="list-decimal space-y-1 ps-5 text-xs text-muted">
	                        <li>
	                          تعداد کارت‌های آماده‌ی مطالعه را از deck{" "}
	                          {WordAnkiConstants.decks.EnToFa} می‌شمارد (is:new OR
	                          is:due).
	                        </li>
                        <li>
                          اگر تعدادشان کمتر از مقدار «تعداد کارت ها برای مطالعه
                          جلسه» باشد، اختلاف را به صورت تعداد نوت از deck{" "}
                          {WordAnkiConstants.decks.tempRoot} برمی‌دارد.
                        </li>
                        <li>
                          اولویت اول: نوت‌هایی که مقدار{" "}
                          <span className="font-mono text-xs">
                            imageability
                          </span>{" "}
                          آن‌ها از{" "}
                          <span className="font-mono text-xs">
                            {imageabilityBaseThreshold}
                          </span>{" "}
                          بیشتر است انتخاب می‌شوند و مرتب‌سازی بر اساس
                          کوتاه‌ترین{" "}
                          <span className="font-mono text-xs">
                            phonetic_us_normalized
                          </span>{" "}
                          است.
                        </li>
                        <li>
                          اگر تعداد کافی نبود، بقیه‌ی نوت‌ها فقط بر اساس
                          کوتاه‌ترین{" "}
                          <span className="font-mono text-xs">
                            phonetic_us_normalized
                          </span>{" "}
                          تکمیل می‌شوند.
                        </li>
                        <li>
                          از نوت‌های انتخاب‌شده کارت‌های نوع EnToFa / FaToEn /
                          Emla انتخاب می‌شوند و به deck های متناظر خودشان منتقل
                          می‌شوند.
                        </li>
                      </ol>

                      {phase3StatusText ? (
                        <div className="text-xs text-foreground/80">
                          {phase3StatusText}
                        </div>
                      ) : null}
                      {phase3Error ? (
                        <div className="text-xs text-red-700">
                          {phase3Error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-muted">
                    تعریف این فاز را بعداً اضافه می‌کنیم.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-xl border border-card bg-background p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground">لاگ</div>
            <button
              type="button"
              onClick={() => setPhaseLogs([])}
              className="h-9 rounded-xl border border-card bg-card px-3 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            >
              پاک کردن
            </button>
          </div>
          <div
            ref={phaseLogBoxRef}
            className="mt-2 max-h-[240px] overflow-auto rounded-xl border border-card bg-card p-3 text-xs text-foreground"
          >
            {phaseLogs.length ? (
              <div className="grid gap-1">
                {phaseLogs.map((line, idx) => (
                  <div key={idx} dir="auto" className="whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted">فعلاً لاگی ثبت نشده.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void openFieldsModal()}
            className="h-10 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground shadow-elevated transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            View target note fields
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={ankiLinkId}
            onChange={(e) => setAnkiLinkId(e.target.value)}
            placeholder="Example: 69404cca7aa46fd41264bdee"
            className="h-11 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={isLoading}
            className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-card bg-background p-3">
          <div className="text-sm font-semibold text-foreground">
            Browse main notes
          </div>
          <div className="mt-1 text-xs text-muted">
            Fetches notes of model{" "}
            <span className="font-mono">
              {AnkiNoteTypes.META_LEX_VR9}
            </span>{" "}
            via AnkiConnect search.
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={String(browseLimit)}
              onChange={(e) => setBrowseLimit(Number(e.target.value))}
              inputMode="numeric"
              placeholder="Limit (e.g. 50)"
              className="h-11 w-full rounded-xl border border-card bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)] sm:w-[160px]"
            />
            <input
              value={browseQueryExtra}
              onChange={(e) => setBrowseQueryExtra(e.target.value)}
              placeholder='Extra query (optional), e.g. deck:"English"'
              className="h-11 w-full rounded-xl border border-card bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="button"
              onClick={() => void browseMainNotes()}
              disabled={isLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
            >
              {isLoading ? "Loading..." : "Load"}
            </button>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void startSyncAll()}
                disabled={syncAllRunning}
                className="h-10 rounded-xl border border-card bg-card px-3 text-sm font-semibold text-foreground hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
              >
                {syncAllRunning
                  ? "Syncing hint_sentence (ALL)..."
                  : "Sync hint_sentence (ALL)"}
              </button>
              {syncAllRunning ? (
                <button
                  type="button"
                  onClick={() => void requestStopSyncAll()}
                  className="h-10 rounded-xl border border-card bg-card px-3 text-sm font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Stop (after current)
                </button>
              ) : null}
              {syncAllError ? (
                <span
                  className="max-w-[420px] truncate text-xs text-red-700"
                  title={syncAllError}
                >
                  {syncAllError}
                </span>
              ) : null}
            </div>
            {syncAllStatusText ? (
              <div className="text-xs text-muted">{syncAllStatusText}</div>
            ) : null}
          </div>
        </div>
      </div>

      {fieldsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-card bg-card p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-foreground">
                  Target note fields
                </div>
                <div className="mt-1 text-xs text-muted">
                  Reads model fields via AnkiConnect.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFieldsModalOpen(false)}
                className="h-9 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="text-sm">
                Model:{" "}
                <span className="font-mono">
                  {AnkiNoteTypes.META_LEX_VR9}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void ensureHintSentenceField()}
                disabled={modelBusy}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {modelBusy ? "Working..." : "Ensure hint_sentence field"}
              </button>

              {modelError ? (
                <div className="w-full text-sm text-red-700">{modelError}</div>
              ) : null}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-card bg-background p-3">
              {modelFields ? (
                <ul className="space-y-1 text-sm text-foreground">
                  {modelFields.map((f) => (
                    <li key={f} className="font-mono">
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-muted">No fields loaded.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {baseFormLookupModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-card bg-card p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div className="text-right">
                <div className="text-base font-semibold text-foreground">
                  قرار دادن در صف مطالعه
                </div>
                <div className="mt-1 text-xs text-muted">
                  آرایه مستقیم کلمات یا خروجی <code>word-extraction</code> را paste کن.
                  اگر ورودی شامل <code>items</code> باشد، همه آیتم‌ها flatten می‌شوند و بعد
                  با <code>base_form</code> در جدول <code>Word</code> جستجو می‌شوند.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBaseFormLookupModalOpen(false)}
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
                    <div className="text-xs text-muted">{baseFormLookupInputStatus}</div>
                  ) : null}
                </div>
                <textarea
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
                    onClick={() => void runBaseFormLookup()}
                    disabled={baseFormLookupLoading}
                    className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                  >
                    {baseFormLookupLoading ? "در حال جستجو..." : "ساختن آرایه note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void addLookupNotesToStudyQueue()}
                    disabled={baseFormQueueLoading || baseFormLookupNoteIds.length === 0}
                    className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                  >
                    {baseFormQueueLoading ? "در حال افزودن..." : "افزودن به صف مطالعه"}
                  </button>
                </div>
                {baseFormQueueStatus ? (
                  <div className="text-xs text-muted">{baseFormQueueStatus}</div>
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
          </div>
        </div>
      ) : null}

      {studyCandidatesModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[88vh] w-full max-w-7xl flex-col rounded-2xl border border-card bg-card p-5 shadow-elevated">
            <div className="flex items-start justify-between gap-3">
              <div className="text-right">
                <div className="text-base font-semibold text-foreground">
                  نوت‌های {AnkiNoteTypes.META_LEX_VR9} خارج از دک‌های مطالعه
                </div>
                <div className="mt-1 text-xs text-muted">
                  فقط نوت‌هایی نمایش داده می‌شوند که هیچ کارتی از آن‌ها داخل
                  <code> {WordAnkiConstants.decks.EnToFa} </code>
                  یا
                  <code> {WordAnkiConstants.decks.FaToEn} </code>
                  نباشد.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudyCandidatesModalOpen(false)}
                className="h-9 rounded-xl border border-card bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
              >
                بستن
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                dir="auto"
                value={studyCandidatesQuery}
                onChange={(e) => setStudyCandidatesQuery(e.target.value)}
                placeholder="جستجو در انگلیسی، معنی، جمله مثال یا معنی جمله مثال"
                className="h-11 min-w-[280px] flex-1 rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted focus:ring-2 focus:ring-[var(--ring)]"
              />
              <button
                type="button"
                onClick={() => void searchStudyCandidates()}
                disabled={studyCandidatesLoading}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {studyCandidatesLoading ? "در حال جستجو..." : "جستجو"}
              </button>
            </div>

            {studyCandidatesError ? (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                {studyCandidatesError}
              </div>
            ) : null}

            {studyCandidatesStatus ? (
              <div className="mt-3 text-xs text-muted">{studyCandidatesStatus}</div>
            ) : null}

            <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-h-0 overflow-auto rounded-xl border border-card bg-background">
                <table className="min-w-[900px] w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-card text-right">
                      <th className="px-3 py-2 font-semibold text-foreground">
                        انتخاب
                      </th>
                      <th className="px-3 py-2 font-semibold text-foreground">
                        انگلیسی
                      </th>
                      <th className="px-3 py-2 font-semibold text-foreground">
                        معنی
                      </th>
                      <th className="px-3 py-2 font-semibold text-foreground">
                        جمله مثال
                      </th>
                      <th className="px-3 py-2 font-semibold text-foreground">
                        معنی جمله مثال
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {studyCandidates.map((row) => {
                      const checked = Boolean(selectedStudyCandidateIds[row.anki_link_id]);
                      return (
                        <tr
                          key={`${row.anki_link_id}_${row.noteId}`}
                          className="border-b border-card/70 align-top"
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleStudyCandidate(row, e.target.checked)}
                              className="h-4 w-4 rounded border border-card"
                            />
                          </td>
                          <td className="px-3 py-3 text-foreground">{row.base_form}</td>
                          <td className="px-3 py-3 text-foreground">{row.meaning_fa}</td>
                          <td className="px-3 py-3 text-foreground">{row.sentence_en}</td>
                          <td className="px-3 py-3 text-foreground">
                            {row.sentence_en_meaning_fa}
                          </td>
                        </tr>
                      );
                    })}
                    {!studyCandidatesLoading && studyCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                          فعلاً رکوردی برای نمایش نیست.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border border-card bg-background p-3">
                <div className="text-sm font-semibold text-foreground">
                  انتخاب‌شده‌ها
                </div>
                <div className="mt-1 text-xs text-muted">
                  با زدن اعمال، خود کلمه و guide wordهای وابسته به‌صورت درختی وارد
                  چرخه مطالعه می‌شوند.
                </div>

                <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-xl border border-card bg-card p-3">
                  {Object.values(selectedStudyCandidateIds).length ? (
                    <div className="grid gap-2">
                      {Object.values(selectedStudyCandidateIds).map((row) => (
                        <div
                          key={row.anki_link_id}
                          className="rounded-lg border border-card bg-background p-2"
                        >
                          <div className="text-sm font-semibold text-foreground">
                            {row.base_form}
                          </div>
                          <div className="text-xs text-muted">{row.meaning_fa}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted">هنوز چیزی انتخاب نشده است.</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void applySelectedStudyCandidates()}
                  disabled={
                    studyCandidatesApplyLoading ||
                    Object.values(selectedStudyCandidateIds).length === 0
                  }
                  className="mt-3 h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                >
                  {studyCandidatesApplyLoading
                    ? "در حال اعمال..."
                    : "اعمال ساختار درختی و انتقال"}
                </button>
                {studyCandidatesApplyStatus ? (
                  <div className="mt-2 text-xs text-muted">
                    {studyCandidatesApplyStatus}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notesInfo ? (
        <div className="rounded-2xl border border-card bg-card p-2 shadow-elevated">
          <div className="overflow-auto rounded-xl border border-card bg-background">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-card">
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    <span className="font-mono text-xs">base_form</span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    <span className="font-mono text-xs">meaning_fa</span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    <span className="font-mono text-xs">hint_sentence</span>
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-foreground">
                    Fields
                  </th>
                </tr>
              </thead>
              <tbody>
                {notesInfo.map((note, idx) => {
                  const isOpen = Boolean(openNoteIds[note.noteId]);
                  const fieldCount = Object.keys(note.fields ?? {}).length;
                  const baseFormRaw = note.fields?.base_form?.value ?? "";
                  const meaningFaRaw = note.fields?.meaning_fa?.value ?? "";
                  const hintSentenceRaw =
                    note.fields?.hint_sentence?.value ?? "";
                  const baseForm = stripSoundTags(baseFormRaw);
                  const meaningFa = stripSoundTags(meaningFaRaw);
                  const hintSentence = stripSoundTags(hintSentenceRaw);
                  const updating = Boolean(updatingNoteIds[note.noteId]);
                  const updateError = updateErrors[note.noteId] ?? null;
                  return (
                    <Fragment key={note.noteId}>
                      <tr className="border-b border-card">
                        <td className="px-3 py-2 text-muted">{idx + 1}</td>
                        <td className="px-3 py-2 text-foreground">
                          {baseForm ? (
                            <span
                              className="whitespace-pre-wrap"
                              title={baseFormRaw || undefined}
                            >
                              {baseForm}
                            </span>
                          ) : (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          {meaningFa ? (
                            <span
                              className="whitespace-pre-wrap"
                              title={meaningFaRaw || undefined}
                            >
                              {meaningFa}
                            </span>
                          ) : (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground">
                          <div className="flex flex-col gap-1">
                            <div className="text-foreground">
                              {hintSentence ? (
                                <span
                                  className="whitespace-pre-wrap"
                                  title={hintSentenceRaw || undefined}
                                >
                                  {hintSentence}
                                </span>
                              ) : (
                                <span className="opacity-60">—</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={updating}
                                onClick={() =>
                                  void updateHintSentence(note.noteId)
                                }
                                className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                              >
                                {updating ? "Updating..." : "Update"}
                              </button>
                              {updateError ? (
                                <span
                                  className="max-w-[260px] truncate text-[11px] text-red-700"
                                  title={updateError}
                                >
                                  {updateError}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenNoteIds((prev) => ({
                                ...prev,
                                [note.noteId]: !Boolean(prev[note.noteId]),
                              }))
                            }
                            className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                          >
                            {isOpen ? "Hide" : "Show"} ({fieldCount})
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-card">
                          <td className="px-3 py-3" />
                          <td className="px-3 py-3" colSpan={4}>
                            <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                              <span>
                                Note ID:{" "}
                                <span className="font-mono text-foreground">
                                  {note.noteId}
                                </span>
                              </span>
                              <span>
                                Model:{" "}
                                <span className="text-foreground">
                                  {note.modelName}
                                </span>
                              </span>
                              <span className="truncate">
                                Tags:{" "}
                                <span className="text-foreground">
                                  {note.tags?.length
                                    ? note.tags.join(", ")
                                    : "—"}
                                </span>
                              </span>
                            </div>
                            <div className="overflow-auto rounded-xl border border-card bg-card">
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr className="border-b border-card">
                                    <th className="px-3 py-2 text-left font-semibold text-foreground">
                                      Field
                                    </th>
                                    <th className="px-3 py-2 text-left font-semibold text-foreground">
                                      Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(note.fields).map(
                                    ([fieldName, field]) => (
                                      <tr
                                        key={fieldName}
                                        className="border-b border-card last:border-b-0"
                                      >
                                        <td className="w-[220px] px-3 py-2 font-mono text-foreground">
                                          {fieldName}
                                        </td>
                                        <td
                                          className="px-3 py-2 text-foreground whitespace-pre-wrap"
                                          title={field.value || undefined}
                                        >
                                          {field.value
                                            ? stripSoundTags(field.value) || "—"
                                            : "—"}
                                        </td>
                                      </tr>
                                    ),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
