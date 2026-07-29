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
  const [targetDeck, setTargetDeck] = useState<string>(WordAnkiConstants.decks.FaToEn);
  const [sourceCardType, setSourceCardType] = useState<string>(WordAnkiConstants.cardTypes.EnToFa);
  const [targetCardType, setTargetCardType] = useState<string>(WordAnkiConstants.cardTypes.FaToEn);
  const [options, setOptions] = useState<AnkiOptions>({ decks: DECKS, cardTypes: CARD_TYPES });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    </main>
  );
}
