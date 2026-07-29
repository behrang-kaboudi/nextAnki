"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ankiOperations } from "@/lib/anki";
import {
  createDefaultEditableDeckConfig,
  createDefaultAnkiStructureConfig,
  DEFAULT_STUDY_CONFIG_NAME,
  normalizeDeckConfigName,
  normalizeAnkiStructureConfig,
  validateAnkiStructureConfig,
  type AnkiStructureConfig,
} from "@/lib/anki/structureSettings";

import { copyTemplatesFromAnki } from "./copyTemplatesFromAnki";
import { ensureMetaLexVr9CardTypes } from "./ensureCardTypes";
import { ensureDeckConfigs } from "./ensureDeckConfigs";
import { ensureRequiredDecks } from "./ensureDecks";
import { inspectAnkiStructure, type StructureInspection } from "./inspectStructure";
import { moveDefaultMetaLexVr9CardsToTemp } from "./moveDefaultCardsToTemp";
import { ensureMetaLexVr9NoteType } from "./ensureNoteType";
import { ensureMetaLexVr9Templates } from "./ensureTemplates";
import { getInitialFactor, getNewInts, getPerDay } from "./deckConfigHelpers";
import type { LogLevel, StepResult, StructureLog, StructureStepStatus } from "./types";

type SettingsResponse = {
  ok: boolean;
  config?: unknown;
  version?: number;
  updatedAt?: string | null;
  isPersisted?: boolean;
  error?: string;
  errors?: string[];
};

function levelForLine(line: string): LogLevel {
  if (line.startsWith("✗")) return "error";
  if (line.startsWith("✓") || line.endsWith("done.") || line.endsWith("Done.")) return "success";
  if (line.startsWith("⚠") || line.toLowerCase().includes("warning")) return "warning";
  return "info";
}

const idleSteps = Object.fromEntries(
  Array.from({ length: 6 }, (_, index) => [
    index + 1,
    { state: "idle", detail: "هنوز بررسی نشده است." } satisfies StructureStepStatus,
  ]),
) as Record<number, StructureStepStatus>;

function minutesToSteps(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((step) => `${Number(step)}m`).join(" ");
}

function ensureMissingConsumerDecksUseDefault(config: AnkiStructureConfig) {
  const consumerDeckIds = new Set(
    config.noteType.cardTypes
      .map((card) => card.deckId)
      .filter((deckId): deckId is string => Boolean(deckId)),
  );
  const assignedDeckIds = new Set(config.deckConfigs.flatMap((item) => item.deckIds));
  const missingDeckIds = config.decks
    .filter((deck) => consumerDeckIds.has(deck.id) && !assignedDeckIds.has(deck.id))
    .map((deck) => deck.id);
  if (!missingDeckIds.length) return config;

  const deckConfigs = config.deckConfigs.map((item) => ({ ...item, deckIds: [...item.deckIds] }));
  const fallback = deckConfigs.find((item) => item.configName === DEFAULT_STUDY_CONFIG_NAME);
  if (fallback) {
    fallback.deckIds = Array.from(new Set([...fallback.deckIds, ...missingDeckIds]));
  } else {
    deckConfigs.push(createDefaultEditableDeckConfig("config-default-study", missingDeckIds));
  }
  return normalizeAnkiStructureConfig({
    ...config,
    deckConfigs,
    noteType: {
      ...config.noteType,
      cardTypes: config.noteType.cardTypes,
    },
  });
}

async function readDeckConfigsFromAnki(config: AnkiStructureConfig) {
  const readings = await Promise.all(
    config.decks.map(async (deck) => {
      const result = await ankiOperations.getDeckConfig({ deck: deck.name });
      return result.ok && result.result ? { deck, anki: result.result } : null;
    }),
  );
  if (!readings.some(Boolean)) return config;

  const deckConfigs = [...config.deckConfigs];
  const consumerDeckIds = new Set(
    config.noteType.cardTypes
      .map((card) => card.deckId)
      .filter((deckId): deckId is string => Boolean(deckId)),
  );
  let fallbackConfig = deckConfigs.find((item) => item.configName === DEFAULT_STUDY_CONFIG_NAME);
  for (const reading of readings) {
    if (!reading) continue;
    const { deck, anki } = reading;
    const current = deckConfigs.find(
      (item) => normalizeDeckConfigName(item.configName) === normalizeDeckConfigName(anki.name) || item.deckIds.includes(deck.id),
    );
    if (!current) {
      if (!consumerDeckIds.has(deck.id)) continue;
      if (!fallbackConfig) {
        fallbackConfig = createDefaultEditableDeckConfig(`config-anki-default-${deck.id}`, [deck.id]);
        deckConfigs.push(fallbackConfig);
      } else {
        fallbackConfig.deckIds = Array.from(new Set([...fallbackConfig.deckIds, deck.id]));
      }
      continue;
    }
    if (current.configName === DEFAULT_STUDY_CONFIG_NAME) {
      current.deckIds = Array.from(new Set([...current.deckIds, deck.id]));
      continue;
    }
    const next = {
      id: current?.id ?? `config-anki-${deck.id}`,
      deckIds: Array.from(new Set([...(current?.deckIds ?? []), deck.id])),
      configName: normalizeDeckConfigName(anki.name),
      newCardsPerDay: getPerDay(anki.new) ?? current?.newCardsPerDay ?? 20,
      maximumReviewsPerDay: getPerDay(anki.rev) ?? current?.maximumReviewsPerDay ?? 200,
      learningSteps: minutesToSteps(anki.new?.delays) || current?.learningSteps || "",
      relearningSteps: minutesToSteps(anki.lapse?.delays) || current?.relearningSteps || "",
      startingEase: getInitialFactor(anki.new) === null
        ? current?.startingEase ?? ""
        : String((getInitialFactor(anki.new) ?? 0) / 1000),
      easyBonus: typeof anki.rev?.ease4 === "number"
        ? String(anki.rev.ease4)
        : current?.easyBonus ?? "",
      graduatingInterval: String(getNewInts(anki.new)?.[0] ?? current?.graduatingInterval ?? ""),
      easyInterval: String(getNewInts(anki.new)?.[1] ?? current?.easyInterval ?? ""),
      minimumInterval: String(
        (anki.lapse as { minInt?: unknown; min_int?: unknown } | undefined)?.minInt ??
        (anki.lapse as { minInt?: unknown; min_int?: unknown } | undefined)?.min_int ??
        current?.minimumInterval ??
        "1",
      ),
    };
    const index = deckConfigs.findIndex((item) => item.id === next.id);
    if (index >= 0) deckConfigs[index] = next;
    else deckConfigs.push(next);
  }
  const mergedByName = new Map<string, (typeof deckConfigs)[number]>();
  for (const item of deckConfigs) {
    const existing = mergedByName.get(item.configName);
    if (!existing) {
      mergedByName.set(item.configName, item);
      continue;
    }
    existing.deckIds = Array.from(new Set([...existing.deckIds, ...item.deckIds]));
  }
  return normalizeAnkiStructureConfig({ ...config, deckConfigs: Array.from(mergedByName.values()) });
}

export function useStructureBuilder() {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settings, setSettingsState] = useState<AnkiStructureConfig>(createDefaultAnkiStructureConfig);
  const [settingsVersion, setSettingsVersion] = useState(1);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState<string | null>(null);
  const [isSettingsPersisted, setIsSettingsPersisted] = useState(false);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<StructureLog[]>([]);
  const [manualIntervalsRequiredDecks, setManualIntervalsRequiredDecks] = useState<string[]>([]);
  const [inspection, setInspection] = useState<StructureInspection | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<number, StructureStepStatus>>(idleSteps);
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  const logIdRef = useRef(0);
  const syncInProgressRef = useRef(false);

  const appendLog = useCallback((line: string) => {
    logIdRef.current += 1;
    setLogs((prev) => [
      ...prev,
      {
        id: logIdRef.current,
        at: new Date().toISOString(),
        level: levelForLine(line),
        message: line,
      },
    ]);
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch("/api/anki/structure-settings", { cache: "no-store" });
      const body = (await response.json()) as SettingsResponse;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "بارگذاری تنظیمات ناموفق بود.");
      let loadedConfig = ensureMissingConsumerDecksUseDefault(normalizeAnkiStructureConfig(body.config));
      const ankiVersion = await ankiOperations.version();
      if (ankiVersion.ok) {
        loadedConfig = await readDeckConfigsFromAnki(loadedConfig);
        appendLog("✓ Configهای موجود در Anki خوانده و با صفحه تطبیق داده شدند.");
      }
      setSettingsState(loadedConfig);
      setSettingsVersion(body.version ?? 1);
      setSettingsUpdatedAt(body.updatedAt ?? null);
      setIsSettingsPersisted(Boolean(body.isPersisted));
      setIsSettingsDirty(false);
      setSettingsErrors([]);
    } catch (error) {
      appendLog(`✗ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [appendLog]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const setSettings = useCallback((next: AnkiStructureConfig) => {
    setSettingsState(next);
    setSettingsErrors(validateAnkiStructureConfig(next));
    setIsSettingsDirty(true);
    setInspection(null);
    setStepStatuses(idleSteps);
  }, []);

  const saveSettings = useCallback(async (nextSettings: AnkiStructureConfig = settings) => {
    const errors = validateAnkiStructureConfig(nextSettings);
    setSettingsErrors(errors);
    if (errors.length) return false;
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/anki/structure-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: nextSettings }),
      });
      const body = (await response.json()) as SettingsResponse;
      if (!response.ok || !body.ok) {
        const message = body.errors?.join(" ") ?? body.error ?? "ذخیره تنظیمات ناموفق بود.";
        throw new Error(message);
      }
      setSettingsState(normalizeAnkiStructureConfig(body.config));
      setSettingsVersion(body.version ?? settingsVersion);
      setSettingsUpdatedAt(body.updatedAt ?? null);
      setIsSettingsPersisted(true);
      setIsSettingsDirty(false);
      appendLog("✓ تنظیمات در دیتابیس ذخیره شد.");
      return true;
    } catch (error) {
      appendLog(`✗ ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }, [appendLog, settings, settingsVersion]);

  const resetSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/anki/structure-settings", { method: "DELETE" });
      const body = (await response.json()) as SettingsResponse;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "بازگردانی تنظیمات ناموفق بود.");
      setSettingsState(normalizeAnkiStructureConfig(body.config));
      setSettingsVersion(body.version ?? 1);
      setSettingsUpdatedAt(null);
      setIsSettingsPersisted(false);
      setIsSettingsDirty(false);
      setSettingsErrors([]);
      setInspection(null);
      setStepStatuses(idleSteps);
      appendLog("✓ تنظیمات پیش‌فرض بازیابی شد.");
      return true;
    } catch (error) {
      appendLog(`✗ ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsSavingSettings(false);
    }
  }, [appendLog]);

  const checkStructure = useCallback(async () => {
    setIsRunning(true);
    setStepStatuses(
      Object.fromEntries(
        Array.from({ length: 6 }, (_, index) => [
          index + 1,
          { state: "checking", detail: "در حال بررسی…" },
        ]),
      ),
    );
    appendLog("بررسی بدون تغییر ساختار Anki شروع شد.");
    try {
      const result = await inspectAnkiStructure(settings);
      setInspection(result);
      setStepStatuses(result.steps);
      appendLog(
        result.connected
          ? "✓ بررسی ساختار بدون ایجاد تغییر تمام شد."
          : "✗ اتصال به AnkiConnect برقرار نشد.",
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendLog(`✗ بررسی ساختار شکست خورد: ${message}`);
      setStepStatuses(idleSteps);
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [appendLog, settings]);

  const runStep = useCallback(
    async (step: number, runner: () => Promise<StepResult>) => {
      if (isRunning) return { ok: false } as const;
      setIsRunning(true);
      setStepStatuses((prev) => ({ ...prev, [step]: { state: "running", detail: "در حال اجرا…" } }));
      try {
        const result = await runner();
        setStepStatuses((prev) => ({
          ...prev,
          [step]: {
            state: result.ok ? "success" : "error",
            detail: result.ok ? "با موفقیت انجام شد." : "اجرا ناموفق بود؛ Log را بررسی کنید.",
          },
        }));
        return result;
      } catch (error) {
        appendLog(`✗ ${error instanceof Error ? error.message : String(error)}`);
        setStepStatuses((prev) => ({
          ...prev,
          [step]: { state: "error", detail: "خطای پیش‌بینی‌نشده رخ داد." },
        }));
        return { ok: false } as const;
      } finally {
        setIsRunning(false);
      }
    },
    [appendLog, isRunning],
  );

  const step1EnsureDecks = useCallback(
    () => runStep(1, () => ensureRequiredDecks(appendLog, settings)),
    [appendLog, runStep, settings],
  );
  const step2EnsureDeckConfigs = useCallback(
    () => runStep(2, () => ensureDeckConfigs(appendLog, setManualIntervalsRequiredDecks, settings)),
    [appendLog, runStep, settings],
  );
  const step3EnsureMetaLexVr9CardTypes = useCallback(
    () => {
      const errors = validateAnkiStructureConfig(settings);
      if (errors.length) {
        setSettingsErrors(errors);
        appendLog("✗ Card Typeها به‌دلیل خطای اعتبارسنجی به Anki ارسال نشدند.");
        return Promise.resolve({ ok: false } as const);
      }
      return runStep(3, () => ensureMetaLexVr9CardTypes(appendLog, settings));
    },
    [appendLog, runStep, settings],
  );
  const syncCardTypes = useCallback(async () => {
    if (isRunning) return false;
    if (isSettingsDirty) {
      const saved = await saveSettings(settings);
      if (!saved) return false;
    }
    const result = await step3EnsureMetaLexVr9CardTypes();
    if (!result.ok) setIsSettingsDirty(true);
    return result.ok;
  }, [isRunning, isSettingsDirty, saveSettings, settings, step3EnsureMetaLexVr9CardTypes]);
  const step4EnsureMetaLexVr9NoteType = useCallback(
    () => runStep(4, () => ensureMetaLexVr9NoteType(appendLog, settings)),
    [appendLog, runStep, settings],
  );
  const step5EnsureMetaLexVr9Templates = useCallback(
    () => runStep(5, () => ensureMetaLexVr9Templates(appendLog, settings)),
    [appendLog, runStep, settings],
  );
  const step6MoveDefaultCardsToTemp = useCallback(
    () => runStep(6, () => moveDefaultMetaLexVr9CardsToTemp(appendLog, settings)),
    [appendLog, runStep, settings],
  );

  const syncSettingsToAnki = useCallback(async (nextSettings: AnkiStructureConfig) => {
    if (syncInProgressRef.current || isRunning) return false;
    const errors = validateAnkiStructureConfig(nextSettings);
    if (errors.length) return false;

    syncInProgressRef.current = true;
    appendLog("همگام‌سازی زنده با Anki شروع شد.");
    try {
      const decksResult = await ensureRequiredDecks(appendLog, nextSettings);
      if (!decksResult.ok) return false;
      const configsResult = await ensureDeckConfigs(
        appendLog,
        setManualIntervalsRequiredDecks,
        nextSettings,
      );
      if (!configsResult.ok) return false;
      const cardTypesResult = await ensureMetaLexVr9CardTypes(appendLog, nextSettings);
      if (!cardTypesResult.ok) return false;
      const noteTypeResult = await ensureMetaLexVr9NoteType(appendLog, nextSettings);
      if (!noteTypeResult.ok) return false;
      const templatesResult = await ensureMetaLexVr9Templates(appendLog, nextSettings);
      if (!templatesResult.ok) return false;
      appendLog("✓ تغییرات بدون نیاز به کلیک روی ذخیره، در Anki اعمال شد.");
      return true;
    } catch (error) {
      appendLog(`✗ AnkiConnect در دسترس نیست؛ تغییرات محلی نگه داشته شد: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [appendLog, isRunning]);

  const saveAndSyncSettings = useCallback(async (nextSettings: AnkiStructureConfig = settings) => {
    const saved = await saveSettings(nextSettings);
    if (!saved) return false;
    const synced = await syncSettingsToAnki(nextSettings);
    if (!synced) {
      setIsSettingsDirty(true);
      appendLog("⚠ تنظیمات در دیتابیس ذخیره شد، اما به Anki نرسید؛ پس از رفع خطا دوباره تلاش کنید.");
    }
    return synced;
  }, [appendLog, saveSettings, settings, syncSettingsToAnki]);

  const handleCopyTemplatesFromAnki = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      await copyTemplatesFromAnki(appendLog);
    } finally {
      setIsRunning(false);
    }
  }, [appendLog, isRunning]);

  const handleCreateStructure = useCallback(async () => {
    if (isRunning) return;
    const errors = validateAnkiStructureConfig(settings);
    if (errors.length) {
      setSettingsErrors(errors);
      appendLog("✗ پیش از اجرا، خطاهای تنظیمات را برطرف کنید.");
      return;
    }
    if (isSettingsDirty) {
      const saved = await saveSettings(settings);
      if (!saved) return;
    }
    setIsRunning(true);
    setManualIntervalsRequiredDecks([]);
    appendLog("هماهنگ‌سازی کامل ساختار شروع شد.");
    const runners: Array<() => Promise<StepResult>> = [
      () => ensureRequiredDecks(appendLog, settings),
      () => ensureDeckConfigs(appendLog, setManualIntervalsRequiredDecks, settings),
      () => ensureMetaLexVr9CardTypes(appendLog, settings),
      () => ensureMetaLexVr9NoteType(appendLog, settings),
      () => ensureMetaLexVr9Templates(appendLog, settings),
      () => moveDefaultMetaLexVr9CardsToTemp(appendLog, settings),
    ];
    try {
      for (let index = 0; index < runners.length; index += 1) {
        const step = index + 1;
        setStepStatuses((prev) => ({ ...prev, [step]: { state: "running", detail: "در حال اجرا…" } }));
        const result = await runners[index]();
        setStepStatuses((prev) => ({
          ...prev,
          [step]: {
            state: result.ok ? "success" : "error",
            detail: result.ok ? "با موفقیت انجام شد." : "اجرا در این مرحله متوقف شد.",
          },
        }));
        if (!result.ok) return;
      }
      appendLog("✓ هماهنگ‌سازی کامل ساختار انجام شد.");
    } catch (error) {
      appendLog(`✗ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  }, [appendLog, isRunning, isSettingsDirty, saveSettings, settings]);

  return {
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
    saveAndSyncSettings,
    syncSettingsToAnki,
    resetSettings,
    checkStructure,
    clearLogs: () => setLogs([]),
    handleCreateStructure,
    step1EnsureDecks,
    step2EnsureDeckConfigs,
    step3EnsureMetaLexVr9CardTypes,
    syncCardTypes,
    step4EnsureMetaLexVr9NoteType,
    step5EnsureMetaLexVr9Templates,
    step6MoveDefaultCardsToTemp,
    handleCopyTemplatesFromAnki,
  };
}
