"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ankiRequestDetailed, type AnkiDeckConfig } from "@/lib/AnkiConnect";
import { WordAnkiConstants, WordDeckConfigs } from "@/lib/AnkiDeck/constants";

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseNumber(raw: string): number | null {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

function parseSteps(text: string): number[] | null {
  const raw = text.trim();
  if (!raw) return null;
  const parts = raw.split(/\s+/g).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const m = /^(\d+(?:\.\d+)?)([smhd])$/i.exec(p);
    if (!m) return null;
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const minutes =
      unit === "s"
        ? n / 60
        : unit === "m"
          ? n
          : unit === "h"
            ? n * 60
            : n * 1440;
    out.push(minutes);
  }
  return out;
}

function arraysEqual(a: number[] | null, b: number[] | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getPerDay(section: AnkiDeckConfig["new"] | AnkiDeckConfig["rev"]): number | null {
  if (!section) return null;
  return asNumber((section as { perDay?: unknown }).perDay) ?? asNumber((section as { per_day?: unknown }).per_day);
}

function setPerDay(section: NonNullable<AnkiDeckConfig["new"] | AnkiDeckConfig["rev"]>, value: number) {
  (section as { perDay?: number }).perDay = value;
  (section as { per_day?: number }).per_day = value;
}

function getInitialFactor(section: AnkiDeckConfig["new"]): number | null {
  if (!section) return null;
  return asNumber((section as { initialFactor?: unknown }).initialFactor) ??
    asNumber((section as { initial_factor?: unknown }).initial_factor);
}

function setInitialFactor(section: NonNullable<AnkiDeckConfig["new"]>, value: number) {
  (section as { initialFactor?: number }).initialFactor = value;
  (section as { initial_factor?: number }).initial_factor = value;
}

function getNewInts(section: AnkiDeckConfig["new"]): number[] | null {
  if (!section) return null;
  return Array.isArray(section.ints) ? section.ints : null;
}

function setGraduatingAndEasyIntervals(
  section: NonNullable<AnkiDeckConfig["new"]>,
  graduatingDays: number,
  easyDays: number,
) {
  const ints = Array.isArray(section.ints) ? section.ints.slice() : [1, 4, 7];
  ints[0] = graduatingDays;
  ints[1] = easyDays;
  if (typeof ints[2] !== "number") ints[2] = 7;
  section.ints = ints;
}

export default function StructureBuilderPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [manualIntervalsRequiredDecks, setManualIntervalsRequiredDecks] = useState<string[]>([]);
  const [helpKey, setHelpKey] = useState<null | "create" | "step1" | "step2" | "step3" | "step4">(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  function appendLog(line: string) {
    setLogs((prev) => [...prev, line]);
  }

  useEffect(() => {
    const el = logBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const requiredDecks = useMemo(
    () => [
      WordAnkiConstants.decks.tempRoot,
      WordAnkiConstants.decks.root,
      WordAnkiConstants.decks.EnToFa,
      WordAnkiConstants.decks.FaToEn,
      WordAnkiConstants.decks.Emla,
      WordAnkiConstants.decks.Rahnama,
      WordAnkiConstants.decks.Rahnama2,
    ],
    [],
  );

  async function loadDeckNames() {
    const res = await ankiRequestDetailed("deckNames");
    if (!res.ok) return { ok: false as const, error: res.error };
    const deckNames = res.result;
    if (!deckNames) return { ok: false as const, error: "AnkiConnect returned null for deckNames." };
    return { ok: true as const, deckNames, deckSet: new Set(deckNames) };
  }

  async function step1EnsureDecks() {
    appendLog("Step 1: Ensure decks (roots + subdecks)...");

    const before = await loadDeckNames();
    if (!before.ok) {
      appendLog(`✗ ${before.error}`);
      return { ok: false as const };
    }

    const missing = requiredDecks.filter((d) => !before.deckSet.has(d));
    for (const deck of requiredDecks) {
      appendLog(`${before.deckSet.has(deck) ? "✓" : "✗"} ${deck}`);
    }

    for (const deck of missing) {
      appendLog(`Creating deck: ${deck} ...`);
      const res = await ankiRequestDetailed("createDeck", { deck });
      if (!res.ok) {
        appendLog(`✗ createDeck failed: ${res.error}`);
        return { ok: false as const };
      }
      appendLog(`✓ Created (id=${res.result})`);
    }

    const after = await loadDeckNames();
    if (!after.ok) {
      appendLog(`✗ ${after.error}`);
      return { ok: false as const };
    }
    for (const deck of requiredDecks) {
      appendLog(`${after.deckSet.has(deck) ? "✓ Confirmed" : "✗ Still missing"}: ${deck}`);
    }

    appendLog("Step 1: Done.");
    return { ok: true as const };
  }

  function deckConfigPairs() {
    return [
      { deck: WordAnkiConstants.decks.EnToFa, configName: "WordsForNewStudyEnToFa" as const },
      { deck: WordAnkiConstants.decks.FaToEn, configName: "WordsForNewStudyFaToEn" as const },
      { deck: WordAnkiConstants.decks.Emla, configName: "WordsForNewStudyEmla" as const },
      { deck: WordAnkiConstants.decks.Rahnama, configName: "WordsForNewStudyRahnama" as const },
      { deck: WordAnkiConstants.decks.Rahnama2, configName: "WordsForNewStudyRahnama2" as const },
    ] as const;
  }

  async function step2EnsureDeckConfigs() {
    appendLog("Step 2: Ensure deck configs (create + apply)...");
    setManualIntervalsRequiredDecks([WordAnkiConstants.decks.Rahnama, WordAnkiConstants.decks.Rahnama2]);

    const deckNamesRes = await loadDeckNames();
    if (!deckNamesRes.ok) {
      appendLog(`✗ ${deckNamesRes.error}`);
      return { ok: false as const };
    }

    const configByName = new Map<string, AnkiDeckConfig>();
    for (const deckName of deckNamesRes.deckNames) {
      const cfgRes = await ankiRequestDetailed("getDeckConfig", { deck: deckName });
      if (!cfgRes.ok || !cfgRes.result) continue;
      if (!configByName.has(cfgRes.result.name)) configByName.set(cfgRes.result.name, cfgRes.result);
    }

    async function saveConfig(config: AnkiDeckConfig) {
      const res = await ankiRequestDetailed("saveDeckConfig", { config });
      if (!res.ok) return { ok: false as const, error: res.error };
      if (res.result !== true) return { ok: false as const, error: `saveDeckConfig returned ${String(res.result)}.` };
      return { ok: true as const };
    }

    async function applyConfigToDeck(deck: string, configId: number) {
      const res = await ankiRequestDetailed("setDeckConfigId", { decks: [deck], configId });
      if (!res.ok) return { ok: false as const, error: res.error };
      if (res.result !== true) return { ok: false as const, error: `setDeckConfigId returned ${String(res.result)}.` };
      return { ok: true as const };
    }

    for (const pair of deckConfigPairs()) {
      const desired = WordDeckConfigs[pair.configName];

      const wantsNewPerDay = desired.newCardsPerDay;
      const wantsRevPerDay = desired.maximumReviewsPerDay;
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
        (desired as { EasyBonus?: string }).EasyBonus ??
        (desired as { easyBonus?: string }).easyBonus ??
        null;
      const wantsGraduatingIntervalRaw =
        (desired as { graduatingInterval?: string }).graduatingInterval ??
        (desired as { GraduatingInterval?: string }).GraduatingInterval ??
        null;
      const wantsEasyIntervalRaw =
        (desired as { easyInterval?: string }).easyInterval ??
        (desired as { EasyInterval?: string }).EasyInterval ??
        null;

      const wantsLearningSteps = wantsLearningStepsRaw ? parseSteps(wantsLearningStepsRaw) : null;
      const wantsRelearningSteps = wantsRelearningStepsRaw ? parseSteps(wantsRelearningStepsRaw) : null;
      const wantsStartingEase = wantsStartingEaseRaw ? parseNumber(wantsStartingEaseRaw) : null;
      const wantsInitialFactor = wantsStartingEase !== null ? Math.round(wantsStartingEase * 1000) : null;
      const wantsEasyBonus = wantsEasyBonusRaw ? parseNumber(wantsEasyBonusRaw) : null;
      const wantsGraduatingIntervalDays = wantsGraduatingIntervalRaw ? parseNumber(wantsGraduatingIntervalRaw) : null;
      const wantsEasyIntervalDays = wantsEasyIntervalRaw ? parseNumber(wantsEasyIntervalRaw) : null;

      appendLog(`Deck: ${pair.deck}`);
      appendLog(`Config: ${pair.configName}`);

      const currentRes = await ankiRequestDetailed("getDeckConfig", { deck: pair.deck });
      if (!currentRes.ok) {
        appendLog(`✗ getDeckConfig failed: ${currentRes.error}`);
        return { ok: false as const };
      }
      const current = currentRes.result;
      if (!current) {
        appendLog("✗ getDeckConfig returned null.");
        return { ok: false as const };
      }

      let target: AnkiDeckConfig | null =
        current.name === pair.configName ? current : (configByName.get(pair.configName) ?? null);

      if (!target) {
        appendLog(`Creating config group: ${pair.configName} ...`);
        const cloneRes = await ankiRequestDetailed("cloneDeckConfigId", { name: pair.configName, cloneFrom: current.id });
        if (!cloneRes.ok) {
          appendLog(`✗ cloneDeckConfigId failed: ${cloneRes.error}`);
          return { ok: false as const };
        }
        const clonedId = cloneRes.result;
        if (!clonedId) {
          appendLog("✗ cloneDeckConfigId returned an empty id.");
          return { ok: false as const };
        }

        const newConfig: AnkiDeckConfig = { ...current, id: clonedId, name: pair.configName };
        newConfig.new = { ...(newConfig.new ?? {}) };
        newConfig.lapse = { ...(newConfig.lapse ?? {}) };
        newConfig.rev = { ...(newConfig.rev ?? {}) };

        setPerDay(newConfig.new, wantsNewPerDay);
        setPerDay(newConfig.rev, wantsRevPerDay);
        if (wantsLearningSteps) newConfig.new.delays = wantsLearningSteps;
        if (wantsRelearningSteps) newConfig.lapse.delays = wantsRelearningSteps;
        if (wantsInitialFactor !== null) setInitialFactor(newConfig.new, wantsInitialFactor);
        if (wantsEasyBonus !== null) newConfig.rev.ease4 = wantsEasyBonus;
        if (wantsGraduatingIntervalDays !== null && wantsEasyIntervalDays !== null) {
          setGraduatingAndEasyIntervals(newConfig.new, wantsGraduatingIntervalDays, wantsEasyIntervalDays);
        }

        const saveRes = await saveConfig(newConfig);
        if (!saveRes.ok) {
          appendLog(`✗ ${saveRes.error}`);
          return { ok: false as const };
        }
        target = newConfig;
        configByName.set(pair.configName, newConfig);
        appendLog("✓ Config created.");
      } else {
        const updated: AnkiDeckConfig = { ...target };
        updated.new = { ...(updated.new ?? {}) };
        updated.lapse = { ...(updated.lapse ?? {}) };
        updated.rev = { ...(updated.rev ?? {}) };

        setPerDay(updated.new, wantsNewPerDay);
        setPerDay(updated.rev, wantsRevPerDay);
        if (wantsLearningSteps) updated.new.delays = wantsLearningSteps;
        if (wantsRelearningSteps) updated.lapse.delays = wantsRelearningSteps;
        if (wantsInitialFactor !== null) setInitialFactor(updated.new, wantsInitialFactor);
        if (wantsEasyBonus !== null) updated.rev.ease4 = wantsEasyBonus;
        if (wantsGraduatingIntervalDays !== null && wantsEasyIntervalDays !== null) {
          setGraduatingAndEasyIntervals(updated.new, wantsGraduatingIntervalDays, wantsEasyIntervalDays);
        }

        const curNew = getPerDay(target.new);
        const curRev = getPerDay(target.rev);
        const curLearning = target.new?.delays ?? null;
        const curRelearning = target.lapse?.delays ?? null;
        const curInitialFactor = getInitialFactor(target.new);
        const curEase4 = asNumber(target.rev?.ease4) ?? null;
        const curInts = getNewInts(target.new);

        const wantsInts =
          wantsGraduatingIntervalDays !== null && wantsEasyIntervalDays !== null
            ? [wantsGraduatingIntervalDays, wantsEasyIntervalDays]
            : null;

        const needsUpdate =
          curNew !== wantsNewPerDay ||
          curRev !== wantsRevPerDay ||
          (wantsLearningSteps ? !arraysEqual(curLearning, wantsLearningSteps) : false) ||
          (wantsRelearningSteps ? !arraysEqual(curRelearning, wantsRelearningSteps) : false) ||
          (wantsInitialFactor !== null ? curInitialFactor !== wantsInitialFactor : false) ||
          (wantsEasyBonus !== null ? curEase4 !== wantsEasyBonus : false) ||
          (wantsInts ? !(Array.isArray(curInts) && curInts[0] === wantsInts[0] && curInts[1] === wantsInts[1]) : false);

        if (needsUpdate) {
          const saveRes = await saveConfig(updated);
          if (!saveRes.ok) {
            appendLog(`✗ ${saveRes.error}`);
            return { ok: false as const };
          }
          target = updated;
          configByName.set(pair.configName, updated);
          appendLog("✓ Config updated.");
        } else {
          appendLog("✓ Config already matches.");
        }
      }

      appendLog(`Applying config to deck (id=${target.id}) ...`);
      const applyRes = await applyConfigToDeck(pair.deck, target.id);
      if (!applyRes.ok) {
        appendLog(`✗ ${applyRes.error}`);
        return { ok: false as const };
      }

      const confirmRes = await ankiRequestDetailed("getDeckConfig", { deck: pair.deck });
      if (!confirmRes.ok || !confirmRes.result) {
        appendLog("✗ Failed to confirm deck config.");
        return { ok: false as const };
      }
      const confirm = confirmRes.result;

      const confirmNew = getPerDay(confirm.new);
      const confirmRev = getPerDay(confirm.rev);
      if (confirm.name !== pair.configName || confirmNew !== wantsNewPerDay || confirmRev !== wantsRevPerDay) {
        appendLog(`✗ Confirm mismatch: name=${confirm.name} new/day=${confirmNew} reviews/day=${confirmRev}`);
        return { ok: false as const };
      }

      if (wantsGraduatingIntervalDays !== null && wantsEasyIntervalDays !== null) {
        const confirmInts = getNewInts(confirm.new);
        const ok =
          Array.isArray(confirmInts) &&
          confirmInts[0] === wantsGraduatingIntervalDays &&
          confirmInts[1] === wantsEasyIntervalDays;
        if (!ok) appendLog(`⚠ Interval not confirmed (new.ints=${confirmInts ? JSON.stringify(confirmInts) : "null"}).`);
      }

      appendLog(`✓ Applied: ${pair.configName}`);
    }

    appendLog("Step 2: Done.");
    return { ok: true as const };
  }

  async function step3EnsureMetaLexVr9NoteType() {
    appendLog("Step 3: Ensure note type (Meta-LEX-vR9) + exact fields...");

    const permRes = await ankiRequestDetailed("requestPermission");
    if (!permRes.ok) {
      appendLog(`✗ requestPermission failed: ${permRes.error}`);
      return { ok: false as const };
    }
    if (!permRes.result) {
      appendLog("✗ requestPermission returned null.");
      return { ok: false as const };
    }
    if (permRes.result.permission !== "granted") {
      appendLog("✗ Permission denied in AnkiConnect settings.");
      return { ok: false as const };
    }

    const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
    const desiredFields = WordAnkiConstants.noteFields.META_LEX_VR9.slice().map(String);
    const desiredSet = new Set<string>(desiredFields);

    const modelNamesRes = await ankiRequestDetailed("modelNames");
    if (!modelNamesRes.ok || !modelNamesRes.result) {
      appendLog(`✗ modelNames failed: ${modelNamesRes.ok ? "null result" : modelNamesRes.error}`);
      return { ok: false as const };
    }

    if (!modelNamesRes.result.includes(modelName)) {
      appendLog(`Creating model: ${modelName} ...`);
      const templates = WordAnkiConstants.noteTemplates.META_LEX_VR9;
      const cardTemplates = [
        { Name: "EnToFa", Front: templates.EnToFa.Front, Back: templates.EnToFa.Back },
        { Name: "FaToEn", Front: templates.FaToEn.Front, Back: templates.FaToEn.Back },
        { Name: "Emla", Front: templates.Emla.Front, Back: templates.Emla.Back },
        { Name: "Rahnama", Front: templates.Rahnama.Front, Back: templates.Rahnama.Back },
        { Name: "Rahnama2", Front: templates.Rahnama2.Front, Back: templates.Rahnama2.Back },
      ];
      const createRes = await ankiRequestDetailed("createModel", {
        modelName,
        inOrderFields: desiredFields,
        cardTemplates,
      });
      if (!createRes.ok) {
        appendLog(`✗ createModel failed: ${createRes.error}`);
        return { ok: false as const };
      }
      appendLog("✓ Model created.");
    } else {
      appendLog("✓ Model exists.");
    }

    const fieldNamesRes = await ankiRequestDetailed("modelFieldNames", { modelName });
    if (!fieldNamesRes.ok || !fieldNamesRes.result) {
      appendLog(`✗ modelFieldNames failed: ${fieldNamesRes.ok ? "null result" : fieldNamesRes.error}`);
      return { ok: false as const };
    }
    const currentFields = fieldNamesRes.result;

    const extras = currentFields.filter((f) => !desiredSet.has(f));
    const missing = desiredFields.filter((f) => !currentFields.includes(f));

    for (const f of extras) {
      appendLog(`Removing field: ${f} ...`);
      const res = await ankiRequestDetailed("modelFieldRemove", { modelName, fieldName: f });
      if (!res.ok) {
        appendLog(`✗ modelFieldRemove failed: ${res.error}`);
        return { ok: false as const };
      }
    }

    for (const f of missing) {
      appendLog(`Adding field: ${f} ...`);
      const res = await ankiRequestDetailed("modelFieldAdd", { modelName, fieldName: f });
      if (!res.ok) {
        appendLog(`✗ modelFieldAdd failed: ${res.error}`);
        return { ok: false as const };
      }
    }

    for (let i = 0; i < desiredFields.length; i += 1) {
      const f = desiredFields[i];
      const res = await ankiRequestDetailed("modelFieldReposition", {
        modelName,
        fieldName: f,
        index: i,
      });
      if (!res.ok) {
        appendLog(`✗ modelFieldReposition failed for ${f}: ${res.error}`);
        return { ok: false as const };
      }
    }

    appendLog("Step 3: Done.");
    return { ok: true as const };
  }

  async function step4EnsureMetaLexVr9Templates() {
    appendLog("Step 4: Ensure note type templates (Meta-LEX-vR9)...");

    const modelName = WordAnkiConstants.noteTypes.META_LEX_VR9;
    const desired = WordAnkiConstants.noteTemplates.META_LEX_VR9;
    const desiredNames = Object.keys(desired) as Array<keyof typeof desired>;

    const templatesRes = await ankiRequestDetailed("modelTemplates", { modelName });
    if (!templatesRes.ok || !templatesRes.result) {
      appendLog(`✗ modelTemplates failed: ${templatesRes.ok ? "null result" : templatesRes.error}`);
      return { ok: false as const };
    }
    const existingNames = new Set(Object.keys(templatesRes.result));
    const missing = desiredNames.filter((name) => !existingNames.has(String(name)));

    if (!missing.length) {
      appendLog("✓ All required templates already exist.");
      appendLog("Step 4: Done.");
      return { ok: true as const };
    }

    for (const name of missing) {
      appendLog(`Adding template: ${String(name)} ...`);
      const tpl = desired[name];
      const res = await ankiRequestDetailed("modelTemplateAdd", {
        modelName,
        template: { Name: String(name), Front: tpl.Front, Back: tpl.Back },
      });
      if (!res.ok) {
        appendLog(`✗ modelTemplateAdd failed: ${res.error}`);
        return { ok: false as const };
      }
    }

    appendLog("✓ Templates ensured.");
    appendLog("Step 4: Done.");
    return { ok: true as const };
  }

  async function handleCreateStructure() {
    setIsRunning(true);
    try {
      appendLog("Create Structure: started.");
      setManualIntervalsRequiredDecks([]);
      const s1 = await step1EnsureDecks();
      if (!s1.ok) return;
      const s2 = await step2EnsureDeckConfigs();
      if (!s2.ok) return;
      const s3 = await step3EnsureMetaLexVr9NoteType();
      if (!s3.ok) return;
      const s4 = await step4EnsureMetaLexVr9Templates();
      if (!s4.ok) return;
      appendLog("Create Structure: done.");
    } finally {
      setIsRunning(false);
    }
  }

  const helpContent = useMemo(() => {
    return {
      create: {
        title: "Create Structure",
        body: (
          <div className="space-y-2 text-sm leading-6">
            <p>همه‌ی Stepها (1 تا 4) را پشت سر هم اجرا می‌کند و نتیجه را در Log می‌نویسد.</p>
            <p className="text-xs opacity-80">
              پیش‌نیاز: Anki باز باشد، افزونه‌ی AnkiConnect فعال باشد و در Step 3 دسترسی (Permission) را در Anki تایید
              کرده باشی.
            </p>
          </div>
        ),
      },
      step1: {
        title: "Step 1: Ensure Decks",
        body: (
          <div className="space-y-2 text-sm leading-6">
            <p>دک‌های اصلی و زیر-دک‌ها را چک می‌کند و اگر وجود نداشته باشند می‌سازد.</p>
            <p className="text-xs opacity-80">
              این Step فقط ساختار Deck را می‌سازد (تنظیمات و Note Type را تغییر نمی‌دهد).
            </p>
          </div>
        ),
      },
      step2: {
        title: "Step 2: Ensure Deck Configs",
        body: (
          <div className="space-y-2 text-sm leading-6">
            <p>Deck Configهای مورد نیاز را ایجاد/پیدا می‌کند و روی Deckهای مربوطه اعمال می‌کند.</p>
            <p className="text-xs opacity-80">
              اگر بعد از اجرا یک هشدار قرمز دیدی، یعنی برای deckِ Rahnama باید دو interval را دستی در Anki بررسی/تنظیم
              کنی.
            </p>
          </div>
        ),
      },
      step3: {
        title: "Step 3: Ensure Note Type",
        body: (
          <div className="space-y-2 text-sm leading-6">
            <p>Note Type با نام {WordAnkiConstants.noteTypes.META_LEX_VR9} را می‌سازد/بررسی می‌کند.</p>
            <p>
              سپس فیلدها را دقیقاً مطابق{" "}
              <span className="font-mono">WordAnkiConstants.noteFields.META_LEX_VR9</span> سینک می‌کند: فیلد اضافه را
              حذف می‌کند، فیلدهای کم را اضافه می‌کند و ترتیب را هم دقیقاً همان ترتیب ثابت‌ها قرار می‌دهد.
            </p>
            <p className="text-xs opacity-80">
              اگر یک فیلد جدید (مثلاً <span className="font-mono">other_meanings_fa</span>) به noteFields اضافه کردی،
              همین Step را اجرا کن تا در Anki هم ساخته شود.
            </p>
          </div>
        ),
      },
      step4: {
        title: "Step 4: Ensure Templates",
        body: (
          <div className="space-y-2 text-sm leading-6">
            <p>Templateهای کارت‌ها (EnToFa / FaToEn / Emla / Rahnama) را برای Note Type تنظیم/ایجاد می‌کند.</p>
            <p className="text-xs opacity-80">اگر خروجی کارت‌ها درست نیست، بعد از Step 3 معمولاً اجرای Step 4 کافی است.</p>
          </div>
        ),
      },
    } as const;
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeader title="Structure Builder" subtitle="Build structure + log output." />

      <section className="rounded-2xl border border-card bg-card p-5 shadow-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <div className="text-sm font-semibold text-foreground">Actions</div>
            <div className="text-xs text-muted">Run steps to sync Anki deck/model setup.</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setHelpKey("create")}
                className="h-7 self-end rounded-lg border border-card bg-background px-2 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Help
              </button>
              <button
                type="button"
                onClick={handleCreateStructure}
                disabled={isRunning}
                className="h-11 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "..." : "Create Structure"}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setHelpKey("step1")}
                className="h-7 self-end rounded-lg border border-card bg-background px-2 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Help
              </button>
              <button
                type="button"
                onClick={step1EnsureDecks}
                disabled={isRunning}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "..." : "Step 1: Ensure Decks"}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setHelpKey("step2")}
                className="h-7 self-end rounded-lg border border-card bg-background px-2 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Help
              </button>
              <button
                type="button"
                onClick={step2EnsureDeckConfigs}
                disabled={isRunning}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "..." : "Step 2: Ensure Deck Configs"}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setHelpKey("step3")}
                className="h-7 self-end rounded-lg border border-card bg-background px-2 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Help
              </button>
              <button
                type="button"
                onClick={step3EnsureMetaLexVr9NoteType}
                disabled={isRunning}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "..." : "Step 3: Ensure Note Type"}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setHelpKey("step4")}
                className="h-7 self-end rounded-lg border border-card bg-background px-2 text-xs font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/5"
              >
                Help
              </button>
              <button
                type="button"
                onClick={step4EnsureMetaLexVr9Templates}
                disabled={isRunning}
                className="h-11 rounded-xl border border-card bg-background px-4 text-sm font-semibold text-foreground shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                {isRunning ? "..." : "Step 4: Ensure Templates"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <div className="text-sm font-semibold text-foreground">Log</div>

          {manualIntervalsRequiredDecks.length ? (
            <div
              dir="rtl"
              className="rounded-xl border border-red-500/30 bg-red-600/10 p-3 text-sm font-semibold text-red-700"
            >
              بعد از اجرای Step 2 باید این دو مورد را برای دک{" "}
              <span className="font-mono">{manualIntervalsRequiredDecks.join(" , ")}</span> به صورت دستی در Anki تنظیم/بررسی کنی:
              <div dir="ltr" className="mt-2 font-normal text-left">
                <span className="font-mono">New Cards -&gt; Graduating interval</span>:{" "}
                <span className="font-mono">5</span>
                {"  "} | {"  "}
                <span className="font-mono">New Cards -&gt; Easy interval</span>: <span className="font-mono">6</span>
              </div>
            </div>
          ) : null}

          <div
            ref={logBoxRef}
            className="max-h-[180px] min-h-[72px] overflow-auto rounded-xl border border-card bg-background p-3"
          >
            {logs.length ? (
              <div className="grid gap-2">
                {logs.map((line, index) => (
                  <div key={`${index}-${line}`} className="font-mono text-xs text-muted">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted">No logs yet.</div>
            )}
          </div>
        </div>
      </section>

      {helpKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div
            dir="rtl"
            lang="fa"
            className="flex w-full max-w-2xl flex-col rounded-2xl border border-card bg-background p-4 text-right shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">راهنما</div>
                <div className="mt-1 text-xs opacity-80">{helpContent[helpKey].title}</div>
              </div>
              <button
                type="button"
                onClick={() => setHelpKey(null)}
                className="rounded-lg border border-card bg-background px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4">{helpContent[helpKey].body}</div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpKey(null)}
                className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
