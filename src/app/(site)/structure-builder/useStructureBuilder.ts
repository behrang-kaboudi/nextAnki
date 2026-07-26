"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createDefaultAnkiStructureConfig,
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
      setSettingsState(normalizeAnkiStructureConfig(body.config));
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
    () => runStep(3, () => ensureMetaLexVr9CardTypes(appendLog, settings)),
    [appendLog, runStep, settings],
  );
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
  }, [appendLog, isRunning, settings]);

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
    resetSettings,
    checkStructure,
    clearLogs: () => setLogs([]),
    handleCreateStructure,
    step1EnsureDecks,
    step2EnsureDeckConfigs,
    step3EnsureMetaLexVr9CardTypes,
    step4EnsureMetaLexVr9NoteType,
    step5EnsureMetaLexVr9Templates,
    step6MoveDefaultCardsToTemp,
    handleCopyTemplatesFromAnki,
  };
}
