"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import {
  ankiOperations,
  chunkArray,
  quoteAnkiSearchValue,
  WordAnkiConstants,
} from "@/lib/anki";

const BATCH_SIZE = 200;
const CARD_TYPES = Object.values(WordAnkiConstants.cardTypes);
const DECKS = Object.values(WordAnkiConstants.decks);

type AnkiOptions = { decks: string[]; cardTypes: string[] };

async function findCards(query: string) {
  const response = await ankiOperations.findCards({ query });
  if (!response.ok) throw new Error(response.error);
  return Array.isArray(response.result) ? response.result : [];
}

export default function AnkiCardTransferClient() {
  const [sourceDeck, setSourceDeck] = useState<string>(WordAnkiConstants.decks.EnToFa);
  const [actionDeck, setActionDeck] = useState<string>(WordAnkiConstants.decks.EnToFa);
  const [targetDeck, setTargetDeck] = useState<string>(WordAnkiConstants.decks.FaToEn);
  const [sourceCardType, setSourceCardType] = useState<string>(WordAnkiConstants.cardTypes.EnToFa);
  const [targetCardType, setTargetCardType] = useState<string>(WordAnkiConstants.cardTypes.FaToEn);
  const [options, setOptions] = useState<AnkiOptions>({ decks: DECKS, cardTypes: CARD_TYPES });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"good" | "easy" | "studyDays" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [studyDaysMax, setStudyDaysMax] = useState<number | "">(7);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [decksResponse, modelsResponse] = await Promise.all([
          ankiOperations.deckNames(),
          ankiOperations.modelNames(),
        ]);
        if (!decksResponse.ok) throw new Error(decksResponse.error);
        if (!modelsResponse.ok) throw new Error(modelsResponse.error);

        const modelNames = modelsResponse.result ?? [];
        const templateResponses = await Promise.all(
          modelNames.map((modelName) => ankiOperations.modelTemplates({ modelName })),
        );
        const cardTypes = new Set<string>();
        for (const response of templateResponses) {
          if (!response.ok || !response.result) continue;
          Object.keys(response.result).forEach((templateName) => cardTypes.add(templateName));
        }
        if (!cancelled) {
          const decks = decksResponse.result?.length ? decksResponse.result : DECKS;
          const resolvedCardTypes = cardTypes.size ? [...cardTypes].sort() : CARD_TYPES;
          setOptions({ decks, cardTypes: resolvedCardTypes });
          setSourceDeck((current) => decks.includes(current) ? current : (decks[0] ?? current));
          setActionDeck((current) => decks.includes(current) ? current : (decks[0] ?? current));
          setTargetDeck((current) => decks.includes(current) ? current : (decks[1] ?? decks[0] ?? current));
          setSourceCardType((current) => resolvedCardTypes.includes(current) ? current : (resolvedCardTypes[0] ?? current));
          setTargetCardType((current) => resolvedCardTypes.includes(current) ? current : (resolvedCardTypes[1] ?? resolvedCardTypes[0] ?? current));
        }
      } catch {
        // Keep the known project values available if AnkiConnect is temporarily offline.
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    void loadOptions();
    return () => { cancelled = true; };
  }, []);

  async function transfer() {
    if (loading) return;
    if (sourceDeck === targetDeck) {
      setError("دک مبدا و مقصد باید متفاوت باشند.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const sourceCardIds = await findCards(
        `deck:${quoteAnkiSearchValue(sourceDeck)} card:${quoteAnkiSearchValue(sourceCardType)}`,
      );
      const sourceInfo = [] as Array<{ note: number }>;
      for (const batch of chunkArray(sourceCardIds, BATCH_SIZE)) {
        const response = await ankiOperations.cardsInfo({ cards: batch });
        if (!response.ok) throw new Error(response.error);
        if (Array.isArray(response.result)) sourceInfo.push(...response.result);
      }

      const noteIds = [...new Set(sourceInfo.map((card) => card.note))];
      const targetCardIds = new Set<number>();
      for (const batch of chunkArray(noteIds, BATCH_SIZE)) {
        if (batch.length === 0) continue;
        const noteQuery = batch.map((noteId) => `nid:${noteId}`).join(" OR ");
        const ids = await findCards(
          `(${noteQuery}) card:${quoteAnkiSearchValue(targetCardType)}`,
        );
        ids.forEach((id) => targetCardIds.add(id));
      }

      const ids = [...targetCardIds];
      for (const batch of chunkArray(ids, BATCH_SIZE)) {
        const response = await ankiOperations.changeDeck({ cards: batch, deck: targetDeck });
        if (!response.ok) throw new Error(response.error);
      }
      setStatus(
        `تعداد کارت‌های مبدا: ${sourceCardIds.length} | نوت‌های یکتا: ${noteIds.length} | کارت‌های مقصد منتقل‌شده: ${ids.length}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ارتباط با AnkiConnect ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }

  async function applyAction() {
    if (actionLoading || !selectedAction) return;

    if (selectedAction === "studyDays" && (studyDaysMax === "" || !Number.isInteger(studyDaysMax) || studyDaysMax < 0)) {
      setActionError("حداکثر روز مطالعه باید یک عدد صحیح صفر یا بزرگ‌تر باشد.");
      return;
    }

    setActionLoading(true);
    setActionStatus(null);
    setActionError(null);
    try {
      const cardIds = await findCards(`deck:${quoteAnkiSearchValue(actionDeck)}`);
      if (!cardIds.length) {
        setActionStatus(`در دک «${actionDeck}» کارتی پیدا نشد.`);
        return;
      }

      if (selectedAction === "studyDays") {
        const maxDays = studyDaysMax === "" ? 0 : studyDaysMax;
        const cardsByDays = new Map<number, number[]>();
        for (const cardId of cardIds) {
          const days = Math.floor(Math.random() * (maxDays + 1));
          const cards = cardsByDays.get(days) ?? [];
          cards.push(cardId);
          cardsByDays.set(days, cards);
        }

        for (const [days, cards] of cardsByDays) {
          for (const batch of chunkArray(cards, BATCH_SIZE)) {
            const response = await ankiOperations.setDueDate({
              cards: batch,
              days: String(days),
            });
            if (!response.ok) throw new Error(response.error);
          }
        }

        setActionStatus(
          `روز مطالعه‌ی ${cardIds.length} کارت در دک «${actionDeck}» با عدد تصادفی بین ۰ تا ${maxDays} تنظیم شد.`,
        );
      } else {
        const ease = selectedAction === "good" ? 3 : 4;
        for (const batch of chunkArray(cardIds, BATCH_SIZE)) {
          const response = await ankiOperations.answerCards({
            answers: batch.map((cardId) => ({ cardId, ease: ease as 3 | 4 })),
          });
          if (!response.ok) throw new Error(response.error);
        }

        setActionStatus(`${cardIds.length} کارت در دک «${actionDeck}» با موفقیت به‌روزرسانی شد.`);
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "اجرای عمل روی کارت‌ها ناموفق بود.");
    } finally {
      setActionLoading(false);
    }
  }

  function selectedActionLabel() {
    if (selectedAction === "good") return "خوب (Good، شماره ۳)";
    if (selectedAction === "easy") return "آسان (Easy، شماره ۴)";
    return `تنظیم روز مطالعه با عدد تصادفی بین ۰ تا ${studyDaysMax}`;
  }

  function select(label: string, value: string, onChange: (value: string) => void, values: readonly string[]) {
    return (
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 rounded-xl border border-card bg-background px-3 text-sm text-foreground">
          {values.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl select-text p-4">
      <div className="grid gap-4">
        <PageHeader title="انتقال کارت بین Deckها" subtitle="کارت متناظر همان Note را بر اساس نوع کارت پیدا و به Deck مقصد منتقل کنید." />
        <section className="grid gap-4 rounded-2xl border border-card bg-background p-4" dir="rtl">
          <div>
            <h2 className="text-lg font-semibold text-foreground">عملیات روی کارت‌های یک دک</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              ابتدا دک را انتخاب کنید؛ عملیات انتخاب‌شده روی کارت‌هایی اجرا می‌شود که با دک و فیلترهای این بخش مطابقت دارند.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 rounded-xl border border-card p-4">
              <h3 className="font-semibold text-foreground">انتخاب دک</h3>
              {select("دک موردنظر", actionDeck, setActionDeck, options.decks)}
            </div>

            <div className="grid gap-2 rounded-xl border border-card p-4">
              <h3 className="font-semibold text-foreground">فیلترها</h3>
              <p className="text-sm leading-6 text-muted">
                فعلاً فیلتری تنظیم نشده است؛ همه کارت‌های دک انتخاب‌شده در نظر گرفته می‌شوند.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-card p-4">
            <h3 className="font-semibold text-foreground">عملکرد</h3>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selectedAction === "good"}
                onChange={() => setSelectedAction((current) => current === "good" ? null : "good")}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              خوب (Good، شماره ۳ در Anki)
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selectedAction === "easy"}
                onChange={() => setSelectedAction((current) => current === "easy" ? null : "easy")}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              آسان (Easy، شماره ۴ در Anki)
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={selectedAction === "studyDays"}
                onChange={() => setSelectedAction((current) => current === "studyDays" ? null : "studyDays")}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              تنظیم روز مطالعه
            </label>
            {selectedAction === "studyDays" && <div className="grid gap-2 rounded-xl border border-card p-3 sm:max-w-sm">
              <label htmlFor="study-days-max" className="text-sm font-semibold text-foreground">
                حداکثر روز اضافه‌شده به تاریخ امروز
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="study-days-max"
                  type="number"
                  min={0}
                  step={1}
                  value={studyDaysMax}
                  onChange={(event) => setStudyDaysMax(event.target.value === "" ? "" : Number(event.target.value))}
                  className="h-11 w-24 rounded-xl border border-card bg-background px-3 text-sm text-foreground"
                  aria-describedby="study-days-help"
                />
                <span id="study-days-help" className="text-xs leading-5 text-muted">
                  برای هر کارت عددی تصادفی بین ۰ تا این مقدار انتخاب می‌شود.
                </span>
              </div>
            </div>}
            <button
              type="button"
              onClick={() => setConfirmationOpen(true)}
              disabled={actionLoading || !selectedAction || optionsLoading}
              className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
            >
              {actionLoading ? "در حال اجرای عملکرد…" : "اجرای عملکرد انتخاب‌شده"}
            </button>
            {actionError && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{actionError}</p>}
            {actionStatus && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{actionStatus}</p>}
          </div>
        </section>
        <section className="grid gap-4 rounded-2xl border border-card bg-background p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {select("دک مبدا", sourceDeck, setSourceDeck, options.decks)}
            {select("دک مقصد", targetDeck, setTargetDeck, options.decks)}
            {select("نوع کارت پایه در دک مبدا", sourceCardType, setSourceCardType, options.cardTypes)}
            {select("نوع کارت مقصد در همان Note", targetCardType, setTargetCardType, options.cardTypes)}
          </div>
          <p className="text-sm leading-6 text-muted">
            {optionsLoading ? "در حال دریافت نام Deckها و نوع کارت‌ها از Anki…" : "برای هر کارت نوع پایه، Note آن پیدا می‌شود؛ سپس همه کارت‌های همان Note با نوع مقصد در کل Anki جست‌وجو می‌شوند."}
          </p>
          <button type="button" onClick={() => void transfer()} disabled={loading} className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60">
            {loading ? "در حال انتقال…" : "انتقال کارت‌ها"}
          </button>
          {error && <p className="text-sm font-semibold text-red-700 dark:text-red-400">{error}</p>}
          {status && <p className="rounded-xl border border-card p-3 text-sm text-foreground">{status}</p>}
        </section>
      </div>
      {confirmationOpen && selectedAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="anki-action-confirmation-title"
        >
          <div className="grid w-full max-w-md gap-4 rounded-2xl border border-card bg-background p-5 shadow-xl" dir="rtl">
            <div className="grid gap-2">
              <h2 id="anki-action-confirmation-title" className="text-lg font-semibold text-foreground">
                تأیید اجرای عملیات
              </h2>
              <p className="text-sm leading-7 text-foreground">
                این عملیات روی همه‌ی کارت‌های دک زیر اجرا می‌شود:
              </p>
              <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                دک: {actionDeck}
              </p>
              <p className="text-sm leading-7 text-foreground">
                عملکرد: <span className="font-semibold">{selectedActionLabel()}</span>
              </p>
              <p className="text-xs leading-6 text-muted">
                لطفاً نام دک را با دقت بررسی کنید. این تغییرات مستقیماً در Anki اعمال می‌شوند.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">
              <button
                type="button"
                onClick={() => setConfirmationOpen(false)}
                disabled={actionLoading}
                className="h-11 rounded-xl border border-card px-4 text-sm font-semibold text-foreground disabled:opacity-60"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmationOpen(false);
                  void applyAction();
                }}
                disabled={actionLoading}
                className="h-11 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                تأیید و اجرای عملیات
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
