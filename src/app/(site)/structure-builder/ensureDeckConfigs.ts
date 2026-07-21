import { ankiOperations, type AnkiDeckConfig } from "@/lib/anki";
import { WordAnkiConstants, WordDeckConfigs } from "@/lib/anki";

import {
  arraysEqual,
  asNumber,
  deckConfigPairs,
  getInitialFactor,
  getNewInts,
  getPerDay,
  parseNumber,
  parseSteps,
  setGraduatingAndEasyIntervals,
  setInitialFactor,
  setPerDay,
} from "./deckConfigHelpers";
import { loadDeckNames } from "./deckNames";
import type { LogFn, StepResult } from "./types";

type ManualIntervalSetter = (decks: string[]) => void;
type DeckConfigPair = ReturnType<typeof deckConfigPairs>[number];

type DesiredDeckConfig = {
  newCardsPerDay: number;
  maximumReviewsPerDay: number;
  learningSteps: number[] | null;
  relearningSteps: number[] | null;
  initialFactor: number | null;
  easyBonus: number | null;
  graduatingIntervalDays: number | null;
  easyIntervalDays: number | null;
};

function desiredDeckConfig(configName: DeckConfigPair["configName"]): DesiredDeckConfig {
  const desired = WordDeckConfigs[configName];

  const wantsLearningStepsRaw = (desired as { learningSteps?: string }).learningSteps ?? null;
  const wantsRelearningStepsRaw =
    (desired as { RelearningSteps?: string }).RelearningSteps ??
    (desired as { relearningSteps?: string }).relearningSteps ??
    null;
  const wantsStartingEaseRaw =
    (desired as { StartingEase?: string }).StartingEase ??
    (desired as { startingEase?: string }).startingEase ??
    null;
  const wantsEasyBonusRaw =
    (desired as { EasyBonus?: string }).EasyBonus ?? (desired as { easyBonus?: string }).easyBonus ?? null;
  const wantsGraduatingIntervalRaw =
    (desired as { graduatingInterval?: string }).graduatingInterval ??
    (desired as { GraduatingInterval?: string }).GraduatingInterval ??
    null;
  const wantsEasyIntervalRaw =
    (desired as { easyInterval?: string }).easyInterval ??
    (desired as { EasyInterval?: string }).EasyInterval ??
    null;

  const startingEase = wantsStartingEaseRaw ? parseNumber(wantsStartingEaseRaw) : null;

  return {
    newCardsPerDay: desired.newCardsPerDay,
    maximumReviewsPerDay: desired.maximumReviewsPerDay,
    learningSteps: wantsLearningStepsRaw ? parseSteps(wantsLearningStepsRaw) : null,
    relearningSteps: wantsRelearningStepsRaw ? parseSteps(wantsRelearningStepsRaw) : null,
    initialFactor: startingEase !== null ? Math.round(startingEase * 1000) : null,
    easyBonus: wantsEasyBonusRaw ? parseNumber(wantsEasyBonusRaw) : null,
    graduatingIntervalDays: wantsGraduatingIntervalRaw ? parseNumber(wantsGraduatingIntervalRaw) : null,
    easyIntervalDays: wantsEasyIntervalRaw ? parseNumber(wantsEasyIntervalRaw) : null,
  };
}

function cloneConfigForUpdate(config: AnkiDeckConfig): AnkiDeckConfig {
  const updated: AnkiDeckConfig = { ...config };
  updated.new = { ...(updated.new ?? {}) };
  updated.lapse = { ...(updated.lapse ?? {}) };
  updated.rev = { ...(updated.rev ?? {}) };
  return updated;
}

function applyDesiredValues(config: AnkiDeckConfig, desired: DesiredDeckConfig) {
  if (!config.new || !config.lapse || !config.rev) return;

  setPerDay(config.new, desired.newCardsPerDay);
  setPerDay(config.rev, desired.maximumReviewsPerDay);
  if (desired.learningSteps) config.new.delays = desired.learningSteps;
  if (desired.relearningSteps) config.lapse.delays = desired.relearningSteps;
  if (desired.initialFactor !== null) setInitialFactor(config.new, desired.initialFactor);
  if (desired.easyBonus !== null) config.rev.ease4 = desired.easyBonus;
  if (desired.graduatingIntervalDays !== null && desired.easyIntervalDays !== null) {
    setGraduatingAndEasyIntervals(config.new, desired.graduatingIntervalDays, desired.easyIntervalDays);
  }
}

function configNeedsUpdate(current: AnkiDeckConfig, desired: DesiredDeckConfig) {
  const curNew = getPerDay(current.new);
  const curRev = getPerDay(current.rev);
  const curLearning = current.new?.delays ?? null;
  const curRelearning = current.lapse?.delays ?? null;
  const curInitialFactor = getInitialFactor(current.new);
  const curEase4 = asNumber(current.rev?.ease4) ?? null;
  const curInts = getNewInts(current.new);
  const wantsInts =
    desired.graduatingIntervalDays !== null && desired.easyIntervalDays !== null
      ? [desired.graduatingIntervalDays, desired.easyIntervalDays]
      : null;

  return (
    curNew !== desired.newCardsPerDay ||
    curRev !== desired.maximumReviewsPerDay ||
    (desired.learningSteps ? !arraysEqual(curLearning, desired.learningSteps) : false) ||
    (desired.relearningSteps ? !arraysEqual(curRelearning, desired.relearningSteps) : false) ||
    (desired.initialFactor !== null ? curInitialFactor !== desired.initialFactor : false) ||
    (desired.easyBonus !== null ? curEase4 !== desired.easyBonus : false) ||
    (wantsInts ? !(Array.isArray(curInts) && curInts[0] === wantsInts[0] && curInts[1] === wantsInts[1]) : false)
  );
}

async function saveConfig(config: AnkiDeckConfig) {
  const res = await ankiOperations.saveDeckConfig({ config });
  if (!res.ok) return { ok: false as const, error: res.error };
  if (res.result !== true) return { ok: false as const, error: `saveDeckConfig returned ${String(res.result)}.` };
  return { ok: true as const };
}

async function applyConfigToDeck(deck: string, configId: number) {
  const res = await ankiOperations.setDeckConfigId({ decks: [deck], configId });
  if (!res.ok) return { ok: false as const, error: res.error };
  if (res.result !== true) return { ok: false as const, error: `setDeckConfigId returned ${String(res.result)}.` };
  return { ok: true as const };
}

async function loadConfigGroupsByName(deckNames: string[]) {
  const configByName = new Map<string, AnkiDeckConfig>();
  for (const deckName of deckNames) {
    const cfgRes = await ankiOperations.getDeckConfig({ deck: deckName });
    if (!cfgRes.ok || !cfgRes.result) continue;
    if (!configByName.has(cfgRes.result.name)) configByName.set(cfgRes.result.name, cfgRes.result);
  }
  return configByName;
}

async function createConfigGroup(
  pair: DeckConfigPair,
  current: AnkiDeckConfig,
  desired: DesiredDeckConfig,
  appendLog: LogFn,
) {
  appendLog(`Creating config group: ${pair.configName} ...`);
  const cloneRes = await ankiOperations.cloneDeckConfigId({ name: pair.configName, cloneFrom: current.id });
  if (!cloneRes.ok) return { ok: false as const, error: `cloneDeckConfigId failed: ${cloneRes.error}` };
  const clonedId = cloneRes.result;
  if (!clonedId) return { ok: false as const, error: "cloneDeckConfigId returned an empty id." };

  const newConfig = cloneConfigForUpdate({ ...current, id: clonedId, name: pair.configName });
  applyDesiredValues(newConfig, desired);

  const saveRes = await saveConfig(newConfig);
  if (!saveRes.ok) return saveRes;

  appendLog("✓ Config created.");
  return { ok: true as const, config: newConfig };
}

async function ensureConfigGroup(
  pair: DeckConfigPair,
  configByName: Map<string, AnkiDeckConfig>,
  appendLog: LogFn,
) {
  const desired = desiredDeckConfig(pair.configName);
  appendLog(`Deck: ${pair.deck}`);
  appendLog(`Config: ${pair.configName}`);

  const currentRes = await ankiOperations.getDeckConfig({ deck: pair.deck });
  if (!currentRes.ok) return { ok: false as const, error: `getDeckConfig failed: ${currentRes.error}` };
  const current = currentRes.result;
  if (!current) return { ok: false as const, error: "getDeckConfig returned null." };

  const existingTarget = current.name === pair.configName ? current : (configByName.get(pair.configName) ?? null);
  if (!existingTarget) {
    const createResult = await createConfigGroup(pair, current, desired, appendLog);
    if (!createResult.ok) return createResult;
    configByName.set(pair.configName, createResult.config);
    return { ok: true as const, config: createResult.config, desired };
  }

  const updated = cloneConfigForUpdate(existingTarget);
  applyDesiredValues(updated, desired);

  if (configNeedsUpdate(existingTarget, desired)) {
    const saveRes = await saveConfig(updated);
    if (!saveRes.ok) return saveRes;
    configByName.set(pair.configName, updated);
    appendLog("✓ Config updated.");
    return { ok: true as const, config: updated, desired };
  }

  appendLog("✓ Config already matches.");
  return { ok: true as const, config: existingTarget, desired };
}

async function confirmDeckConfig(pair: DeckConfigPair, desired: DesiredDeckConfig, appendLog: LogFn): Promise<StepResult> {
  const confirmRes = await ankiOperations.getDeckConfig({ deck: pair.deck });
  if (!confirmRes.ok || !confirmRes.result) {
    appendLog("✗ Failed to confirm deck config.");
    return { ok: false };
  }
  const confirm = confirmRes.result;

  const confirmNew = getPerDay(confirm.new);
  const confirmRev = getPerDay(confirm.rev);
  if (
    confirm.name !== pair.configName ||
    confirmNew !== desired.newCardsPerDay ||
    confirmRev !== desired.maximumReviewsPerDay
  ) {
    appendLog(`✗ Confirm mismatch: name=${confirm.name} new/day=${confirmNew} reviews/day=${confirmRev}`);
    return { ok: false };
  }

  if (desired.graduatingIntervalDays !== null && desired.easyIntervalDays !== null) {
    const confirmInts = getNewInts(confirm.new);
    const ok =
      Array.isArray(confirmInts) &&
      confirmInts[0] === desired.graduatingIntervalDays &&
      confirmInts[1] === desired.easyIntervalDays;
    if (!ok) appendLog(`⚠ Interval not confirmed (new.ints=${confirmInts ? JSON.stringify(confirmInts) : "null"}).`);
  }

  return { ok: true };
}

export async function ensureDeckConfigs(
  appendLog: LogFn,
  setManualIntervalsRequiredDecks: ManualIntervalSetter,
): Promise<StepResult> {
  appendLog("Step 2: Ensure deck configs (create + apply)...");
  setManualIntervalsRequiredDecks([WordAnkiConstants.decks.Rahnama, WordAnkiConstants.decks.Rahnama2]);

  const deckNamesRes = await loadDeckNames();
  if (!deckNamesRes.ok) {
    appendLog(`✗ ${deckNamesRes.error}`);
    return { ok: false };
  }

  const configByName = await loadConfigGroupsByName(deckNamesRes.deckNames);

  for (const pair of deckConfigPairs()) {
    const ensureResult = await ensureConfigGroup(pair, configByName, appendLog);
    if (!ensureResult.ok) {
      appendLog(`✗ ${ensureResult.error}`);
      return { ok: false };
    }

    appendLog(`Applying config to deck (id=${ensureResult.config.id}) ...`);
    const applyRes = await applyConfigToDeck(pair.deck, ensureResult.config.id);
    if (!applyRes.ok) {
      appendLog(`✗ ${applyRes.error}`);
      return { ok: false };
    }

    const confirmResult = await confirmDeckConfig(pair, ensureResult.desired, appendLog);
    if (!confirmResult.ok) return confirmResult;

    appendLog(`✓ Applied: ${pair.configName}`);
  }

  appendLog("Step 2: Done.");
  return { ok: true };
}
