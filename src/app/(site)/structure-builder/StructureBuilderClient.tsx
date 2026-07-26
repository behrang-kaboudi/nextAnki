"use client";

import { useMemo, useState } from "react";

import { ActionIcon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import {
  createStructureId,
  findStructureDeck,
  type AnkiStructureCardType,
  type AnkiStructureDeck,
  type EditableDeckConfig,
} from "@/lib/anki/structureSettings";

import { structureBuilderHelpContent } from "./helpContent";
import type {
  HelpKey,
  LogLevel,
  StructureLog,
  StructureStepStatus,
} from "./types";
import { useStructureBuilder } from "./useStructureBuilder";

type TabKey = "overview" | "decks" | "configs" | "noteType" | "guide" | "logs";

const steps: Array<{
  number: number;
  helpKey: HelpKey;
  title: string;
  subtitle: string;
}> = [
  { number: 1, helpKey: "step1", title: "ساخت دک‌ها", subtitle: "وجود ریشه‌ها و زیردک‌ها" },
  { number: 2, helpKey: "step2", title: "تنظیم مطالعه", subtitle: "Deck Config و intervalها" },
  { number: 3, helpKey: "step3", title: "Card Typeها", subtitle: "بررسی و ساخت نوع کارت‌ها" },
  { number: 4, helpKey: "step4", title: "فیلدهای Note", subtitle: "نام، وجود و ترتیب فیلدها" },
  { number: 5, helpKey: "step5", title: "Templateها", subtitle: "محتوای Front و Back" },
  { number: 6, helpKey: "step6", title: "انتقال امن", subtitle: "Default به دک موقت" },
];

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "نمای کلی" },
  { key: "decks", label: "دک‌ها" },
  { key: "configs", label: "تنظیمات مطالعه" },
  { key: "noteType", label: "Note Type و کارت‌ها" },
  { key: "guide", label: "راهنما" },
  { key: "logs", label: "گزارش اجرا" },
];

function formatDate(value: string | null) {
  if (!value) return "هنوز در دیتابیس ذخیره نشده";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusPresentation(status: StructureStepStatus) {
  switch (status.state) {
    case "ready":
    case "success":
      return { label: status.state === "success" ? "انجام شد" : "هماهنگ", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700" };
    case "needs-change":
      return { label: "نیازمند تغییر", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700" };
    case "running":
    case "checking":
      return { label: status.state === "running" ? "در حال اجرا" : "در حال بررسی", dot: "animate-pulse bg-blue-500", badge: "bg-blue-500/10 text-blue-700" };
    case "error":
      return { label: "خطا", dot: "bg-red-500", badge: "bg-red-500/10 text-red-700" };
    default:
      return { label: "بررسی نشده", dot: "bg-zinc-400", badge: "bg-black/5 text-muted dark:bg-white/10" };
  }
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  dir = "ltr",
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  dir?: "ltr" | "rtl";
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <input
        dir={dir}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none transition focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--ring)]"
      />
      {hint ? <span className="text-[11px] leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div dir="rtl" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-card bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-card p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="grid size-10 shrink-0 place-items-center rounded-full border border-card bg-background text-xl text-muted transition hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}

function HelpModal({ helpKey, onClose }: { helpKey: HelpKey; onClose: () => void }) {
  const content = structureBuilderHelpContent[helpKey];
  return (
    <Modal title="راهنمای این مرحله" subtitle={content.title} onClose={onClose}>
      {content.body}
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className="h-10 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white">
          متوجه شدم
        </button>
      </div>
    </Modal>
  );
}

function ConfigEditor({
  value,
  decks,
  onChange,
  onClose,
}: {
  value: EditableDeckConfig;
  decks: AnkiStructureDeck[];
  onChange: (value: EditableDeckConfig) => void;
  onClose: () => void;
}) {
  const update = (field: keyof EditableDeckConfig, raw: string) => {
    onChange({
      ...value,
      [field]:
        field === "newCardsPerDay" || field === "maximumReviewsPerDay"
          ? Number(raw)
          : raw,
    });
  };

  return (
    <Modal title={`ویرایش ${value.configName || "Deck Config"}`} subtitle="تنظیمات مطالعه و دک مقصد" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="نام Deck Config" value={value.configName} onChange={(raw) => update("configName", raw)} />
        </div>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className="text-xs font-semibold">دک متصل</span>
          <select
            value={value.deckId}
            onChange={(event) => update("deckId", event.target.value)}
            className="h-11 rounded-xl border border-card bg-background px-3 text-sm"
          >
            {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title} — {deck.name}</option>)}
          </select>
        </label>
        <Field label="کارت جدید در روز" type="number" value={value.newCardsPerDay} onChange={(raw) => update("newCardsPerDay", raw)} />
        <Field label="حداکثر مرور در روز" type="number" value={value.maximumReviewsPerDay} onChange={(raw) => update("maximumReviewsPerDay", raw)} />
        <Field label="Learning steps" value={value.learningSteps} onChange={(raw) => update("learningSteps", raw)} hint="مثال: 1m 10m 5d" />
        <Field label="Relearning steps" value={value.relearningSteps} onChange={(raw) => update("relearningSteps", raw)} hint="خالی یعنی تغییر داده نشود" />
        <Field label="Starting ease" value={value.startingEase} onChange={(raw) => update("startingEase", raw)} hint="مثال: 2.50" />
        <Field label="Easy bonus" value={value.easyBonus} onChange={(raw) => update("easyBonus", raw)} hint="مثال: 1.3" />
        <Field label="Graduating interval" value={value.graduatingInterval} onChange={(raw) => update("graduatingInterval", raw)} hint="بر حسب روز" />
        <Field label="Easy interval" value={value.easyInterval} onChange={(raw) => update("easyInterval", raw)} hint="بر حسب روز" />
      </div>
      <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs leading-6 text-muted">
        تغییرات فعلاً فقط در فرم نگهداری می‌شوند. برای ماندگارشدن آن‌ها دکمهٔ «ذخیره در دیتابیس» را بزنید؛ برای اعمال روی Anki نیز Step 2 را اجرا کنید.
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="h-10 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white">
          پایان ویرایش
        </button>
      </div>
    </Modal>
  );
}

function CardTypeEditor({
  value,
  decks,
  onChange,
  onClose,
}: {
  value: AnkiStructureCardType;
  decks: AnkiStructureDeck[];
  onChange: (value: AnkiStructureCardType) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`ویرایش ${value.name || "Card Type"}`} subtitle="نام کارت، دک مرتبط و Template" onClose={onClose}>
      <div className="grid gap-4">
        <Field label="نام Card Type" value={value.name} onChange={(name) => onChange({ ...value, name })} />
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold">دک مرتبط</span>
          <select
            value={value.deckId ?? ""}
            onChange={(event) => onChange({ ...value, deckId: event.target.value || null })}
            className="h-11 rounded-xl border border-card bg-background px-3 text-sm"
          >
            <option value="">بدون دک مشخص</option>
            {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title} — {deck.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold">Front Template</span>
          <textarea
            dir="ltr"
            value={value.front}
            onChange={(event) => onChange({ ...value, front: event.target.value })}
            className="min-h-48 resize-y rounded-2xl border border-card bg-[#111318] p-4 font-mono text-xs leading-6 text-zinc-100 outline-none focus:ring-4 focus:ring-[var(--ring)]"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold">Back Template</span>
          <textarea
            dir="ltr"
            value={value.back}
            onChange={(event) => onChange({ ...value, back: event.target.value })}
            className="min-h-48 resize-y rounded-2xl border border-card bg-[#111318] p-4 font-mono text-xs leading-6 text-zinc-100 outline-none focus:ring-4 focus:ring-[var(--ring)]"
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className="h-10 rounded-xl bg-[var(--primary)] px-5 text-sm font-semibold text-white">
          پایان ویرایش
        </button>
      </div>
    </Modal>
  );
}

function LogPanel({
  logs,
  logBoxRef,
  onClear,
}: {
  logs: StructureLog[];
  logBoxRef: React.RefObject<HTMLDivElement | null>;
  onClear: () => void;
}) {
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const filtered = filter === "all" ? logs : logs.filter((log) => log.level === filter);
  const colors: Record<LogLevel, string> = {
    info: "border-blue-500/20 bg-blue-500/5 text-foreground",
    success: "border-emerald-500/20 bg-emerald-500/5 text-emerald-800",
    warning: "border-amber-500/20 bg-amber-500/5 text-amber-800",
    error: "border-red-500/20 bg-red-500/5 text-red-800",
  };

  const copyLogs = async () => {
    await navigator.clipboard.writeText(
      logs.map((log) => `${log.at} [${log.level}] ${log.message}`).join("\n"),
    );
  };

  return (
    <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-foreground">گزارش اجرای زنده</h2>
          <p className="mt-1 text-xs text-muted">{logs.length} رویداد ثبت شده</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as LogLevel | "all")}
            className="h-9 rounded-xl border border-card bg-background px-3 text-xs font-semibold text-foreground"
          >
            <option value="all">همه</option>
            <option value="success">موفق</option>
            <option value="warning">هشدار</option>
            <option value="error">خطا</option>
            <option value="info">اطلاعات</option>
          </select>
          <button type="button" onClick={() => void copyLogs()} disabled={!logs.length} className="h-9 rounded-xl border border-card bg-background px-3 text-xs font-semibold disabled:opacity-40">
            کپی
          </button>
          <button type="button" onClick={onClear} disabled={!logs.length} className="flex h-9 items-center gap-1.5 rounded-xl border border-card bg-background px-3 text-xs font-semibold text-red-700 disabled:opacity-40">
            <ActionIcon name="trash" className="size-3.5" />
            پاک‌کردن
          </button>
        </div>
      </div>
      <div ref={logBoxRef} dir="ltr" className="mt-4 max-h-[360px] min-h-40 overflow-auto rounded-2xl bg-[#111318] p-3 text-left">
        {filtered.length ? (
          <div className="grid gap-2">
            {filtered.map((log) => (
              <div key={log.id} className={`rounded-xl border px-3 py-2 font-mono text-[11px] leading-5 ${colors[log.level]}`}>
                <span className="me-2 opacity-60">{new Date(log.at).toLocaleTimeString("en-CA")}</span>
                {log.message}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-32 place-items-center text-xs text-zinc-500">هنوز گزارشی ثبت نشده است.</div>
        )}
      </div>
    </section>
  );
}

export default function StructureBuilderClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [editingCardType, setEditingCardType] = useState<string | null>(null);
  const {
    isRunning,
    isLoadingSettings,
    isSavingSettings,
    settings,
    settingsVersion,
    settingsUpdatedAt,
    isSettingsPersisted,
    isSettingsDirty,
    settingsErrors,
    logs,
    logBoxRef,
    inspection,
    stepStatuses,
    manualIntervalsRequiredDecks,
    setSettings,
    saveSettings,
    resetSettings,
    checkStructure,
    clearLogs,
    handleCreateStructure,
    step1EnsureDecks,
    step2EnsureDeckConfigs,
    step3EnsureMetaLexVr9CardTypes,
    step4EnsureMetaLexVr9NoteType,
    step5EnsureMetaLexVr9Templates,
    step6MoveDefaultCardsToTemp,
    handleCopyTemplatesFromAnki,
  } = useStructureBuilder();

  const stepRunners = useMemo(
    () => [
      step1EnsureDecks,
      step2EnsureDeckConfigs,
      step3EnsureMetaLexVr9CardTypes,
      step4EnsureMetaLexVr9NoteType,
      step5EnsureMetaLexVr9Templates,
      step6MoveDefaultCardsToTemp,
    ],
    [
      step1EnsureDecks,
      step2EnsureDeckConfigs,
      step3EnsureMetaLexVr9CardTypes,
      step4EnsureMetaLexVr9NoteType,
      step5EnsureMetaLexVr9Templates,
      step6MoveDefaultCardsToTemp,
    ],
  );

  const updateDeck = (id: string, patch: Partial<AnkiStructureDeck>) => {
    setSettings({
      ...settings,
      decks: settings.decks.map((deck) => deck.id === id ? { ...deck, ...patch } : deck),
    });
  };

  const addDeck = () => {
    const id = createStructureId("deck");
    const deckNumber = settings.decks.length + 1;
    setSettings({
      ...settings,
      decks: [...settings.decks, {
        id,
        title: `دک جدید ${deckNumber}`,
        name: `NewDeck${deckNumber}`,
        managed: true,
      }],
    });
  };

  const removeDeck = (id: string) => {
    const deck = findStructureDeck(settings, id);
    if (!deck || !window.confirm(`دک «${deck.title}» و تمام Configهای متصل از تنظیمات حذف شوند؟`)) return;
    const remaining = settings.decks.filter((item) => item.id !== id);
    const fallbackId = remaining[0]?.id ?? "";
    setSettings({
      ...settings,
      decks: remaining,
      deckConfigs: settings.deckConfigs.filter((item) => item.deckId !== id),
      noteType: {
        ...settings.noteType,
        cardTypes: settings.noteType.cardTypes.map((item) =>
          item.deckId === id ? { ...item, deckId: null } : item,
        ),
      },
      moveCards: {
        sourceDeckId: settings.moveCards.sourceDeckId === id ? fallbackId : settings.moveCards.sourceDeckId,
        targetDeckId: settings.moveCards.targetDeckId === id ? fallbackId : settings.moveCards.targetDeckId,
      },
    });
  };

  const updateDeckConfig = (id: string, value: EditableDeckConfig) => {
    setSettings({
      ...settings,
      deckConfigs: settings.deckConfigs.map((item) => item.id === id ? value : item),
    });
  };

  const addDeckConfig = () => {
    const id = createStructureId("config");
    const deckId = settings.decks[0]?.id ?? "";
    const next: EditableDeckConfig = {
      id,
      deckId,
      configName: `NewDeckConfig${settings.deckConfigs.length + 1}`,
      newCardsPerDay: 20,
      maximumReviewsPerDay: 200,
      learningSteps: "1m 10m",
      relearningSteps: "10m",
      startingEase: "2.50",
      easyBonus: "1.3",
      graduatingInterval: "1",
      easyInterval: "4",
    };
    setSettings({ ...settings, deckConfigs: [...settings.deckConfigs, next] });
    setEditingConfig(id);
  };

  const removeDeckConfig = (id: string) => {
    const item = settings.deckConfigs.find((candidate) => candidate.id === id);
    if (!item || !window.confirm(`Deck Config «${item.configName}» از تنظیمات حذف شود؟`)) return;
    setSettings({ ...settings, deckConfigs: settings.deckConfigs.filter((candidate) => candidate.id !== id) });
  };

  const updateCardType = (id: string, value: AnkiStructureCardType) => {
    setSettings({
      ...settings,
      noteType: {
        ...settings.noteType,
        cardTypes: settings.noteType.cardTypes.map((item) => item.id === id ? value : item),
      },
    });
  };

  const addCardType = () => {
    const id = createStructureId("card");
    const frontField = settings.noteType.fields[0] || "Front";
    const backField = settings.noteType.fields[1] || frontField;
    const next: AnkiStructureCardType = {
      id,
      name: `CardType${settings.noteType.cardTypes.length + 1}`,
      deckId: settings.decks[0]?.id ?? null,
      front: `{{${frontField}}}`,
      back: `{{FrontSide}}\n\n<hr id="answer">\n\n{{${backField}}}`,
    };
    setSettings({
      ...settings,
      noteType: { ...settings.noteType, cardTypes: [...settings.noteType.cardTypes, next] },
    });
    setEditingCardType(id);
  };

  const removeCardType = (id: string) => {
    const item = settings.noteType.cardTypes.find((candidate) => candidate.id === id);
    if (!item || !window.confirm(`Card Type «${item.name}» حذف شود؟ اجرای Step 3 آن را از Anki نیز حذف می‌کند.`)) return;
    setSettings({
      ...settings,
      noteType: {
        ...settings.noteType,
        cardTypes: settings.noteType.cardTypes.filter((candidate) => candidate.id !== id),
      },
    });
  };

  const updateField = (index: number, value: string) => {
    const fields = settings.noteType.fields.slice();
    fields[index] = value;
    setSettings({ ...settings, noteType: { ...settings.noteType, fields } });
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= settings.noteType.fields.length) return;
    const fields = settings.noteType.fields.slice();
    [fields[index], fields[target]] = [fields[target], fields[index]];
    setSettings({ ...settings, noteType: { ...settings.noteType, fields } });
  };

  const removeField = (index: number) => {
    const field = settings.noteType.fields[index];
    if (!window.confirm(`فیلد «${field}» حذف شود؟ اجرای Step 4 آن را از Anki نیز حذف می‌کند.`)) return;
    setSettings({
      ...settings,
      noteType: {
        ...settings.noteType,
        fields: settings.noteType.fields.filter((_, fieldIndex) => fieldIndex !== index),
      },
    });
  };

  const confirmReset = async () => {
    if (!window.confirm("تمام تنظیمات ذخیره‌شده حذف و مقادیر کد بازیابی شوند؟")) return;
    await resetSettings();
  };

  return (
    <div dir="rtl" lang="fa" className="mx-auto grid w-full max-w-[1500px] gap-6 text-right">
      <PageHeader title="مدیریت ساختار Anki" subtitle="بررسی، ویرایش و هماهنگ‌سازی دک‌ها، تنظیمات مطالعه و Note Type در یک مرکز کنترل" />

      <section className="relative overflow-hidden rounded-[2rem] border border-blue-500/15 bg-gradient-to-br from-[#071d36] via-[#0b3764] to-[#1464a5] p-5 text-white shadow-2xl sm:p-7">
        <div className="absolute -left-20 -top-24 size-72 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${inspection?.connected ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-white/75"}`}>
                <span className={`size-2 rounded-full ${inspection?.connected ? "bg-emerald-300" : "bg-white/40"}`} />
                {inspection?.connected ? `AnkiConnect ${inspection.version ?? ""}` : "اتصال بررسی نشده"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
                {settings.profileName}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
                نسخه تنظیمات {settingsVersion}
              </span>
              {isSettingsDirty ? <span className="rounded-full bg-amber-300/15 px-3 py-1.5 text-xs font-bold text-amber-200">تغییر ذخیره‌نشده</span> : null}
            </div>
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">ساختار Anki زیر کنترل شماست</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">
                ابتدا بدون هیچ تغییری وضعیت را بررسی کنید؛ سپس فقط اختلاف‌ها یا کل ساختار را هماهنگ کنید.
              </p>
            </div>
            <div className="text-xs text-white/55">
              آخرین ذخیره: {formatDate(settingsUpdatedAt)}
              {inspection?.checkedAt ? ` • آخرین بررسی: ${formatDate(inspection.checkedAt)}` : ""}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:w-[430px]">
            <button
              type="button"
              onClick={() => void checkStructure()}
              disabled={isRunning || isLoadingSettings}
              className="h-12 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:opacity-50"
            >
              {isRunning ? "در حال پردازش…" : "فقط بررسی؛ بدون تغییر"}
            </button>
            <button
              type="button"
              onClick={() => void handleCreateStructure()}
              disabled={isRunning || isLoadingSettings || settingsErrors.length > 0}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-[#0b3764] shadow-lg transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
            >
              <ActionIcon name="sparkles" />
              هماهنگ‌سازی کامل
            </button>
          </div>
        </div>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-card bg-card p-1.5 shadow-elevated">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${activeTab === tab.key ? "bg-[var(--primary)] text-white shadow-md" : "text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"}`}
            >
              {tab.label}
              {tab.key === "logs" && logs.length ? <span className="me-2 rounded-full bg-current/10 px-2 py-0.5 text-[10px]">{logs.length}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {settingsErrors.length ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4 text-sm text-red-700">
          <div className="font-bold">تنظیمات نیاز به اصلاح دارد</div>
          <ul className="mt-2 list-disc space-y-1 pe-5 text-xs leading-6">
            {settingsErrors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">مراحل هماهنگ‌سازی</h2>
                <p className="mt-1 text-xs leading-6 text-muted">هر مرحله مستقل قابل بررسی و اجراست.</p>
              </div>
              <button type="button" onClick={() => setHelpKey("create")} className="text-xs font-bold text-[var(--primary)]">
                راهنمای اجرای کامل
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {steps.map((step, index) => {
                const status = stepStatuses[step.number];
                const appearance = statusPresentation(status);
                return (
                  <article key={step.number} className="group rounded-2xl border border-card bg-background p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--primary)]/10 text-sm font-black text-[var(--primary)]">
                        {step.number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold text-foreground">{step.title}</h3>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${appearance.badge}`}>
                            <span className={`size-1.5 rounded-full ${appearance.dot}`} />
                            {appearance.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">{step.subtitle}</p>
                        <p className="mt-3 min-h-10 text-xs leading-5 text-foreground/70">{status.detail}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2 border-t border-card pt-3">
                      <button
                        type="button"
                        onClick={() => void stepRunners[index]()}
                        disabled={isRunning}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <ActionIcon name="play" className="size-3.5" />
                        اجرای مرحله
                      </button>
                      <button type="button" onClick={() => setHelpKey(step.helpKey)} className="h-9 rounded-xl border border-card px-3 text-xs font-bold text-muted hover:text-foreground">
                        راهنما
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="grid content-start gap-4">
            <section className="rounded-3xl border border-card bg-card p-5 shadow-elevated">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-foreground">تنظیمات فعال</h2>
                  <p className="mt-1 text-xs text-muted">{isSettingsPersisted ? "ذخیره‌شده در MySQL" : "مقادیر پیش‌فرض کد"}</p>
                </div>
                <span className={`size-3 rounded-full ${isSettingsDirty ? "bg-amber-500" : "bg-emerald-500"}`} />
              </div>
              <Field
                label="نام پروفایل"
                dir="rtl"
                value={settings.profileName}
                onChange={(profileName) => setSettings({ ...settings, profileName })}
              />
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={isSavingSettings || !isSettingsDirty || settingsErrors.length > 0}
                  className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-40"
                >
                  {isSavingSettings ? "در حال ذخیره…" : "ذخیره در دیتابیس"}
                </button>
                <button type="button" onClick={() => void confirmReset()} disabled={isSavingSettings} className="h-10 rounded-xl border border-card text-xs font-bold text-muted hover:text-red-700">
                  بازگرداندن پیش‌فرض‌ها
                </button>
              </div>
            </section>

            {manualIntervalsRequiredDecks.length ? (
              <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5">
                <h3 className="text-sm font-bold text-amber-800">بررسی دستی interval</h3>
                <p className="mt-2 text-xs leading-6 text-amber-800/80">
                  پس از Step 2، Graduating و Easy interval دک‌های {manualIntervalsRequiredDecks.join(" و ")} را در Anki نیز بررسی کنید.
                </p>
              </section>
            ) : null}

            <section className="rounded-3xl border border-card bg-card p-5 shadow-elevated">
              <h3 className="text-sm font-bold text-foreground">خلاصه ساختار</h3>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-background p-3">
                  <dt className="text-[10px] text-muted">دک‌ها</dt>
                  <dd className="mt-1 text-xl font-black text-foreground">{settings.decks.length}</dd>
                </div>
                <div className="rounded-2xl bg-background p-3">
                  <dt className="text-[10px] text-muted">Deck Config</dt>
                  <dd className="mt-1 text-xl font-black text-foreground">{settings.deckConfigs.length}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      ) : null}

      {activeTab === "decks" ? (
        <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">نام و ساختار دک‌ها</h2>
              <p className="mt-1 max-w-3xl text-xs leading-6 text-muted">
                هر تعداد دک می‌توانید اضافه کنید. دک‌های Managed در Step 1 ساخته می‌شوند؛ دک‌های غیرمدیریت‌شده فقط به‌عنوان مبدأ یا مرجع استفاده می‌شوند.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={addDeck} className="h-10 rounded-xl border border-[var(--primary)] px-4 text-xs font-bold text-[var(--primary)]">+ افزودن دک</button>
              <button type="button" onClick={() => void saveSettings()} disabled={isSavingSettings || !isSettingsDirty || settingsErrors.length > 0} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white disabled:opacity-40">ذخیره تغییرات</button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {settings.decks.map((deck) => (
              <article key={deck.id} className="rounded-2xl border border-card bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <code className="rounded-lg bg-black/5 px-2 py-1 text-[10px] text-muted dark:bg-white/10">{deck.id}</code>
                  <button type="button" onClick={() => removeDeck(deck.id)} className="text-xs font-bold text-red-700">حذف</button>
                </div>
                <div className="mt-3 grid gap-3">
                  <Field label="عنوان نمایشی" dir="rtl" value={deck.title} onChange={(title) => updateDeck(deck.id, { title })} />
                  <Field label="نام واقعی دک" value={deck.name} onChange={(name) => updateDeck(deck.id, { name })} />
                  <label className="flex items-center justify-between rounded-xl border border-card bg-card px-3 py-2.5 text-xs font-semibold">
                    در Step 1 ساخته و مدیریت شود
                    <input type="checkbox" checked={deck.managed} onChange={(event) => updateDeck(deck.id, { managed: event.target.checked })} className="size-4 accent-[var(--primary)]" />
                  </label>
                </div>
              </article>
            ))}
          </div>
          {!settings.decks.length ? <div className="mt-6 rounded-2xl border border-dashed border-card p-10 text-center text-sm text-muted">هیچ دکی تعریف نشده است.</div> : null}
        </section>
      ) : null}

      {activeTab === "configs" ? (
        <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">تنظیمات مطالعه</h2>
              <p className="mt-1 text-xs leading-6 text-muted">هر تنظیم به یک دک معنایی متصل است و با Step 2 روی Anki اعمال می‌شود.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={addDeckConfig} disabled={!settings.decks.length} className="h-10 rounded-xl border border-[var(--primary)] px-4 text-xs font-bold text-[var(--primary)] disabled:opacity-40">+ افزودن Config</button>
              <button type="button" onClick={() => void saveSettings()} disabled={isSavingSettings || !isSettingsDirty || settingsErrors.length > 0} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white disabled:opacity-40">ذخیره تغییرات</button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {settings.deckConfigs.map((item) => {
              const deck = findStructureDeck(settings, item.deckId);
              return (
                <article key={item.id} className="rounded-2xl border border-card bg-background p-4 transition hover:shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{item.configName}</h3>
                      <p dir="ltr" className="mt-1 truncate text-left font-mono text-[10px] text-muted">{deck?.name ?? "دک نامعتبر"}</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setEditingConfig(item.id)} className="h-8 shrink-0 rounded-lg border border-card bg-card px-3 text-[11px] font-bold text-[var(--primary)]">ویرایش</button>
                      <button type="button" onClick={() => removeDeckConfig(item.id)} className="h-8 shrink-0 rounded-lg border border-red-500/20 bg-red-500/5 px-2 text-[11px] font-bold text-red-700">حذف</button>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-card p-2.5"><dt className="text-[10px] text-muted">New/day</dt><dd className="mt-1 font-bold">{item.newCardsPerDay}</dd></div>
                    <div className="rounded-xl bg-card p-2.5"><dt className="text-[10px] text-muted">Reviews/day</dt><dd className="mt-1 font-bold">{item.maximumReviewsPerDay}</dd></div>
                    <div className="col-span-2 rounded-xl bg-card p-2.5"><dt className="text-[10px] text-muted">Learning steps</dt><dd dir="ltr" className="mt-1 truncate text-left font-mono font-bold">{item.learningSteps || "—"}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
          {!settings.deckConfigs.length ? <div className="mt-6 rounded-2xl border border-dashed border-card p-10 text-center text-sm text-muted">Deck Configی تعریف نشده است.</div> : null}
        </section>
      ) : null}

      {activeTab === "noteType" ? (
        <div className="grid gap-6">
          <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">Note Type</h2>
                <p className="mt-1 text-xs leading-6 text-muted">نام مدل، فیلدها و Card Typeها کاملاً از این بخش مدیریت می‌شوند.</p>
              </div>
              <button type="button" onClick={() => void saveSettings()} disabled={isSavingSettings || !isSettingsDirty || settingsErrors.length > 0} className="h-10 rounded-xl bg-[var(--primary)] px-4 text-xs font-bold text-white disabled:opacity-40">ذخیره تغییرات</button>
            </div>
            <div className="mt-5 max-w-xl">
              <Field label="نام Note Type" value={settings.noteType.name} onChange={(name) => setSettings({ ...settings, noteType: { ...settings.noteType, name } })} />
            </div>
          </section>

          <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-foreground">فیلدها</h2>
                <p className="mt-1 text-xs text-muted">ترتیب این لیست دقیقاً در Step 4 روی Anki اعمال می‌شود.</p>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, noteType: { ...settings.noteType, fields: [...settings.noteType.fields, `field_${settings.noteType.fields.length + 1}`] } })}
                className="h-9 rounded-xl border border-[var(--primary)] px-3 text-xs font-bold text-[var(--primary)]"
              >
                + افزودن فیلد
              </button>
            </div>
            <div className="mt-5 grid gap-2 md:grid-cols-2">
              {settings.noteType.fields.map((field, index) => (
                <div key={index} className="flex items-center gap-2 rounded-2xl border border-card bg-background p-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-card text-xs font-black text-muted">{index + 1}</span>
                  <input dir="ltr" value={field} onChange={(event) => updateField(index, event.target.value)} className="h-9 min-w-0 flex-1 rounded-xl border border-card bg-card px-3 text-sm outline-none focus:ring-4 focus:ring-[var(--ring)]" />
                  <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label={`انتقال ${field} به بالا`} className="size-8 rounded-lg border border-card text-xs disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveField(index, 1)} disabled={index === settings.noteType.fields.length - 1} aria-label={`انتقال ${field} به پایین`} className="size-8 rounded-lg border border-card text-xs disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => removeField(index)} aria-label={`حذف فیلد ${field}`} className="size-8 rounded-lg border border-red-500/20 text-xs text-red-700">×</button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-foreground">Card Typeها و Templateها</h2>
                <p className="mt-1 text-xs leading-6 text-muted">افزودن در Step 3 و محتوای Front/Back در Step 5 اعمال می‌شود. حذف، Card Type و کارت‌های مرتبط را از Anki حذف می‌کند.</p>
              </div>
              <button type="button" onClick={addCardType} className="h-9 rounded-xl border border-[var(--primary)] px-3 text-xs font-bold text-[var(--primary)]">+ افزودن Card Type</button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {settings.noteType.cardTypes.map((card) => {
                const deck = findStructureDeck(settings, card.deckId);
                return (
                  <article key={card.id} className="rounded-2xl border border-card bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold">{card.name}</h3>
                        <p className="mt-1 truncate text-[10px] text-muted">{deck?.name ?? "بدون دک مشخص"}</p>
                      </div>
                      <code className="rounded-lg bg-card px-2 py-1 text-[9px] text-muted">{card.id}</code>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[10px] text-muted">
                      <div className="rounded-xl bg-card p-2">Front: {card.front.length} chars</div>
                      <div className="rounded-xl bg-card p-2">Back: {card.back.length} chars</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => setEditingCardType(card.id)} className="h-9 flex-1 rounded-xl bg-[var(--primary)] text-xs font-bold text-white">ویرایش Template</button>
                      <button type="button" onClick={() => removeCardType(card.id)} className="h-9 rounded-xl border border-red-500/20 px-3 text-xs font-bold text-red-700">حذف</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-amber-500/25 bg-amber-500/5 p-5">
            <h2 className="font-bold text-amber-900">انتقال امن کارت‌ها در Step 6</h2>
            <p className="mt-1 text-xs leading-6 text-amber-900/70">کارت‌های Note Type فعال که دقیقاً در دک مبدأ هستند به دک مقصد منتقل می‌شوند.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold">
                دک مبدأ
                <select value={settings.moveCards.sourceDeckId} onChange={(event) => setSettings({ ...settings, moveCards: { ...settings.moveCards, sourceDeckId: event.target.value } })} className="h-11 rounded-xl border border-card bg-card px-3 text-sm">
                  {settings.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title} — {deck.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold">
                دک مقصد
                <select value={settings.moveCards.targetDeckId} onChange={(event) => setSettings({ ...settings, moveCards: { ...settings.moveCards, targetDeckId: event.target.value } })} className="h-11 rounded-xl border border-card bg-card px-3 text-sm">
                  {settings.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title} — {deck.name}</option>)}
                </select>
              </label>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "guide" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-card bg-card p-5 shadow-elevated lg:col-span-2">
            <h2 className="text-lg font-bold text-foreground">قبل از شروع</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["۱", "Anki را باز کنید", "برنامه باید هنگام بررسی و اجرا فعال باشد."],
                ["۲", "AnkiConnect را فعال کنید", "پورت پیش‌فرض 8765 باید از سیستم محلی در دسترس باشد."],
                ["۳", "اول فقط بررسی کنید", "گزارش اختلاف‌ها هیچ داده‌ای را تغییر نمی‌دهد."],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-2xl bg-background p-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)] text-sm font-black text-white">{number}</span>
                  <h3 className="mt-3 text-sm font-bold">{title}</h3>
                  <p className="mt-1 text-xs leading-6 text-muted">{text}</p>
                </div>
              ))}
            </div>
          </section>
          {steps.map((step) => {
            const content = structureBuilderHelpContent[step.helpKey];
            return (
              <details key={step.number} className="group rounded-3xl border border-card bg-card p-5 shadow-elevated">
                <summary className="flex list-none items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)]/10 text-xs font-black text-[var(--primary)]">{step.number}</span>
                    <div>
                      <div className="text-sm font-bold text-foreground">{step.title}</div>
                      <div className="mt-1 text-[11px] text-muted">{content.title}</div>
                    </div>
                  </div>
                  <span className="text-xl text-muted transition group-open:rotate-45">+</span>
                </summary>
                <div className="mt-5 border-t border-card pt-5">{content.body}</div>
              </details>
            );
          })}
          <section className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
            <h3 className="text-sm font-bold text-red-800">ابزار توسعه: دریافت Template از Anki</h3>
            <p className="mt-2 text-xs leading-6 text-red-800/75">
              این عملیات فایل Template داخل سورس پروژه را بازنویسی می‌کند و برای استفاده روزمره نیست.
            </p>
            <button type="button" onClick={() => setHelpKey("copyTemplates")} className="mt-3 text-xs font-bold text-red-700">جزئیات عملیات</button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Templateهای سورس پروژه با نسخه فعلی Anki بازنویسی شوند؟")) {
                  void handleCopyTemplatesFromAnki();
                }
              }}
              disabled={isRunning}
              className="mt-4 h-10 w-full rounded-xl bg-red-700 px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              Copy Templates from Anki
            </button>
          </section>
        </div>
      ) : null}

      {activeTab === "logs" ? <LogPanel logs={logs} logBoxRef={logBoxRef} onClear={clearLogs} /> : null}

      {activeTab !== "logs" && logs.length ? (
        <button type="button" onClick={() => setActiveTab("logs")} className="fixed bottom-5 left-5 z-30 flex h-11 items-center gap-2 rounded-full bg-[#111318] px-4 text-xs font-bold text-white shadow-2xl">
          گزارش اجرا
          <span className="rounded-full bg-white/15 px-2 py-0.5">{logs.length}</span>
        </button>
      ) : null}

      {helpKey ? <HelpModal helpKey={helpKey} onClose={() => setHelpKey(null)} /> : null}
      {editingConfig && settings.deckConfigs.find((item) => item.id === editingConfig) ? (
        <ConfigEditor
          value={settings.deckConfigs.find((item) => item.id === editingConfig)!}
          decks={settings.decks}
          onChange={(value) => updateDeckConfig(editingConfig, value)}
          onClose={() => setEditingConfig(null)}
        />
      ) : null}
      {editingCardType && settings.noteType.cardTypes.find((item) => item.id === editingCardType) ? (
        <CardTypeEditor
          value={settings.noteType.cardTypes.find((item) => item.id === editingCardType)!}
          decks={settings.decks}
          onChange={(value) => updateCardType(editingCardType, value)}
          onClose={() => setEditingCardType(null)}
        />
      ) : null}
    </div>
  );
}
