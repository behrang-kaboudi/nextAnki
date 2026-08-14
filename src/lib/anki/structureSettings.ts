import { WordAnkiConstants, WordDeckByCardType, WordDeckConfigs } from "./deck/constants";
import { AnkiNoteTypes } from "./deck/notes";
import { defaultStructureCardTypeTemplates } from "./structureCardTypeDefaults";

// Used only to seed a fresh database. Persisted structure settings are the
// source of truth for note fields after the first save.
export const DEFAULT_WORD_NOTE_FIELDS = [
  "anki_link_id",
  "base_form",
  "base_form_audio",
  "first-part-spell",
  "first-part-spell-audio",
  "phonetic_us",
  "pos",
  "meaning_fa",
  "meaning_fa_audio",
  "other_meanings_fa",
  "other_meanings_fa_audio",
  "other_meanings_en",
  "other_meanings_en_audio",
  "concept_explained_fa",
  "concept_explained_fa_audio",
  "sentence_en",
  "sentence_en_audio",
  "sentence_en_meaning_fa",
  "sentence_en_meaning_fa_audio",
  "best_translate",
  "selfGuide",
  "hint_to_select_letters",
  "phonetic_us_normalized",
  "learning_depth",
  "imageability",
  "productive_target",
  "json_hint",
  "updatedAt",
] as const;

const requiredStructureCardTypeTemplates = {
  "1EnToFaKnowingFilter": {
    Front: `{{base_form}}`,
    Back: `{{meaning_fa}}`,
  },
  "1FaToEnKnowingFilter": {
    Front: `{{meaning_fa}}`,
    Back: `{{base_form}}`,
  },
  ...defaultStructureCardTypeTemplates,
} as const;

const legacyDeckKeys = [
  "default",
  "tempRoot",
  "root",
  "EnToFa",
  "EnToFaKnowingFilter",
  "EnToFaRev",
  "FaToEn",
  "FaToEnKnowingFilter",
  "FaToEnRev",
  "Rahnama",
  "Rahnama2",
] as const;

const legacyConfigKeys = [
  "WordsForNewStudyEnToFa",
  "WordsForNewStudy1EnToFaKnowingFilter",
  "WordsForNewStudyEnToFaRev",
  "WordsForNewStudyFaToEn",
  "WordsForNewStudy1FaToEnKnowingFilter",
  "WordsForNewStudyFaToEnRev",
  "WordsForNewStudyRahnama",
  "WordsForNewStudyRahnama2",
] as const;

type LegacyDeckKey = (typeof legacyDeckKeys)[number];
type LegacyConfigKey = (typeof legacyConfigKeys)[number];

const legacyConfigDeckMap: Record<LegacyConfigKey, LegacyDeckKey> = {
  WordsForNewStudyEnToFa: "EnToFa",
  WordsForNewStudy1EnToFaKnowingFilter: "EnToFaKnowingFilter",
  WordsForNewStudyEnToFaRev: "EnToFaRev",
  WordsForNewStudyFaToEn: "FaToEn",
  WordsForNewStudy1FaToEnKnowingFilter: "FaToEnKnowingFilter",
  WordsForNewStudyFaToEnRev: "FaToEnRev",
  WordsForNewStudyRahnama: "Rahnama",
  WordsForNewStudyRahnama2: "Rahnama2",
};

export type AnkiStructureDeck = {
  id: string;
  title: string;
  name: string;
  managed: boolean;
};

export type EditableDeckConfig = {
  id: string;
  deckIds: string[];
  configName: string;
  newCardsPerDay: number;
  maximumReviewsPerDay: number;
  learningSteps: string;
  relearningSteps: string;
  startingEase: string;
  easyBonus: string;
  intervalModifier: string;
  graduatingInterval: string;
  easyInterval: string;
  minimumInterval: string;
};

export const DECK_CONFIG_NAME_PREFIX = "WordsForNewStudy";
export const DEFAULT_STUDY_CONFIG_NAME = `${DECK_CONFIG_NAME_PREFIX}-Default`;

export function normalizeDeckConfigName(value: string, fallbackSuffix = "Default") {
  const raw = value.trim();
  if (!raw || raw === "DefaultStudyConfig" || raw === "Default") {
    return `${DECK_CONFIG_NAME_PREFIX}-${fallbackSuffix}`;
  }
  let suffix = raw.startsWith(`${DECK_CONFIG_NAME_PREFIX}-`)
    ? raw.slice(DECK_CONFIG_NAME_PREFIX.length + 1)
    : raw.startsWith(DECK_CONFIG_NAME_PREFIX)
      ? raw.slice(DECK_CONFIG_NAME_PREFIX.length).replace(/^[-\s]+/, "")
      : raw;
  while (suffix.startsWith(`${DECK_CONFIG_NAME_PREFIX}-`)) {
    suffix = suffix.slice(DECK_CONFIG_NAME_PREFIX.length + 1);
  }
  return `${DECK_CONFIG_NAME_PREFIX}-${suffix || fallbackSuffix}`;
}

export function createDefaultEditableDeckConfig(
  id: string,
  deckIds: string[],
  configName = DEFAULT_STUDY_CONFIG_NAME,
): EditableDeckConfig {
  return {
    id,
    deckIds,
    configName: normalizeDeckConfigName(configName),
    newCardsPerDay: 9999,
    maximumReviewsPerDay: 9999,
    learningSteps: "2m 10m",
    relearningSteps: "2m 10m",
    startingEase: "3.5",
    easyBonus: "1.8",
    intervalModifier: "1",
    graduatingInterval: "1",
    easyInterval: "4",
    minimumInterval: "1",
  };
}

export type AnkiStructureCardType = {
  id: string;
  name: string;
  deckIds: string[];
  front: string;
  back: string;
};

export type AnkiStructureNoteType = {
  name: string;
  fields: string[];
  cardTypes: AnkiStructureCardType[];
};

export type AnkiStructureConfig = {
  schemaVersion: 5;
  profileName: string;
  decks: AnkiStructureDeck[];
  deckConfigs: EditableDeckConfig[];
  noteType: AnkiStructureNoteType;
  moveCards: {
    sourceDeckId: string;
    targetDeckId: string;
  };
};

function optionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function finiteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function deckTitle(key: LegacyDeckKey) {
  const titles: Record<LegacyDeckKey, string> = {
    default: "دک پیش‌فرض Anki",
    tempRoot: "دک موقت",
    root: "ریشهٔ دک‌های مطالعه",
    EnToFa: "انگلیسی به فارسی",
    EnToFaKnowingFilter: "فیلتر شناخت En → Fa",
    EnToFaRev: "مرور معکوس En → Fa",
    FaToEn: "فارسی به انگلیسی",
    FaToEnKnowingFilter: "فیلتر شناخت Fa → En",
    FaToEnRev: "مرور معکوس Fa → En",
    Rahnama: "راهنمای اول",
    Rahnama2: "راهنمای دوم",
  };
  return titles[key];
}

function defaultDeckConfig(key: LegacyConfigKey): EditableDeckConfig {
  const source = WordDeckConfigs[key] as Record<string, unknown>;
  return {
    id: `config-${key}`,
    deckIds: [`deck-${legacyConfigDeckMap[key]}`],
    configName: normalizeDeckConfigName(key, key),
    newCardsPerDay: Number(source.newCardsPerDay),
    maximumReviewsPerDay: Number(source.maximumReviewsPerDay),
    learningSteps: optionalString(source.learningSteps),
    relearningSteps: optionalString(source.RelearningSteps ?? source.relearningSteps),
    startingEase: optionalString(source.StartingEase ?? source.startingEase),
    easyBonus: optionalString(source.EasyBonus ?? source.easyBonus),
    intervalModifier: optionalString(source.IntervalModifier ?? source.intervalModifier ?? "1"),
    graduatingInterval: optionalString(source.graduatingInterval ?? source.GraduatingInterval),
    easyInterval: optionalString(source.easyInterval ?? source.EasyInterval),
    minimumInterval: optionalString(source.minimumInterval ?? source.MinimumInterval ?? "1"),
  };
}

export function createDefaultAnkiStructureConfig(): AnkiStructureConfig {
  const decks = legacyDeckKeys.map((key) => ({
    id: `deck-${key}`,
    title: deckTitle(key),
    name: WordAnkiConstants.decks[key],
    managed: key !== "default",
  }));
  const deckIdByName = new Map(decks.map((deck) => [deck.name, deck.id]));
  const deckConfigs = legacyConfigKeys.map(defaultDeckConfig);
  const cardTypes: AnkiStructureCardType[] = Object.entries(requiredStructureCardTypeTemplates).map(([name, template]) => ({
    id: `card-${name}`,
    name,
    deckIds: [
      deckIdByName.get(
        WordDeckByCardType[name as keyof typeof WordDeckByCardType] ?? "",
      )
    ].filter((deckId): deckId is string => Boolean(deckId)),
    front: template.Front,
    back: template.Back,
  }));

  return {
    schemaVersion: 5,
    profileName: "پروفایل اصلی",
    decks,
    deckConfigs,
    noteType: {
      name: AnkiNoteTypes.META_LEX_VR9,
      fields: DEFAULT_WORD_NOTE_FIELDS.map(String),
      cardTypes,
    },
    moveCards: {
      sourceDeckId: "deck-default",
      targetDeckId: "deck-tempRoot",
    },
  };
}

function normalizeDecks(input: Record<string, unknown>, defaults: AnkiStructureConfig) {
  if (Array.isArray(input.decks)) {
    return input.decks
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item, index) => ({
        id: optionalString(item.id).trim() || `deck-${index + 1}`,
        title: optionalString(item.title).trim() || `دک ${index + 1}`,
        name: optionalString(item.name).trim(),
        managed: item.managed !== false,
      }));
  }

  const legacy =
    input.decks && typeof input.decks === "object"
      ? (input.decks as Record<string, unknown>)
      : {};
  return defaults.decks.map((deck) => {
    const key = deck.id.replace(/^deck-/, "");
    const name = legacy[key];
    return {
      ...deck,
      name: typeof name === "string" && name.trim() ? name.trim() : deck.name,
    };
  });
}

function normalizeDeckConfigItem(
  item: Record<string, unknown>,
  fallback: EditableDeckConfig,
  index: number,
): EditableDeckConfig {
  const text = (field: Exclude<keyof EditableDeckConfig, "deckIds">) =>
    typeof item[field] === "string" ? item[field].trim() : String(fallback[field]);
  const legacyDeckId = typeof item.deckId === "string" ? item.deckId.trim() : "";
  return {
    id: text("id") || `config-${index + 1}`,
    deckIds: Array.isArray(item.deckIds)
      ? item.deckIds
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim())
      : legacyDeckId
        ? [legacyDeckId]
        : fallback.deckIds,
    configName: normalizeDeckConfigName(text("configName"), fallback.configName),
    newCardsPerDay: finiteNumber(item.newCardsPerDay, fallback.newCardsPerDay),
    maximumReviewsPerDay: finiteNumber(item.maximumReviewsPerDay, fallback.maximumReviewsPerDay),
    learningSteps: text("learningSteps"),
    relearningSteps: text("relearningSteps"),
    startingEase: text("startingEase"),
    easyBonus: text("easyBonus"),
    intervalModifier: text("intervalModifier"),
    graduatingInterval: text("graduatingInterval"),
    easyInterval: text("easyInterval"),
    minimumInterval: text("minimumInterval"),
  };
}

function normalizeDeckConfigs(input: Record<string, unknown>, defaults: AnkiStructureConfig) {
  if (Array.isArray(input.deckConfigs)) {
    return input.deckConfigs
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item, index) =>
        normalizeDeckConfigItem(item, defaults.deckConfigs[index] ?? {
          id: `config-${index + 1}`,
          deckIds: [],
          configName: "",
          newCardsPerDay: 9999,
          maximumReviewsPerDay: 9999,
          learningSteps: "2m 10m",
          relearningSteps: "2m 10m",
          startingEase: "3.5",
          easyBonus: "1.8",
          intervalModifier: "1",
          graduatingInterval: "1",
          easyInterval: "4",
          minimumInterval: "1",
        }, index),
      );
  }

  const legacy =
    input.deckConfigs && typeof input.deckConfigs === "object"
      ? (input.deckConfigs as Record<string, unknown>)
      : {};
  return defaults.deckConfigs.map((fallback, index) => {
    const key = legacyConfigKeys[index];
    const raw = legacy[key];
    return normalizeDeckConfigItem(
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {},
      fallback,
      index,
    );
  });
}

function normalizeNoteType(
  input: Record<string, unknown>,
  defaults: AnkiStructureConfig,
) {
  const raw =
    input.noteType && typeof input.noteType === "object"
      ? (input.noteType as Record<string, unknown>)
      : {};
  const fields = Array.isArray(raw.fields)
    ? raw.fields.map(String).map((field) => field.trim())
    : defaults.noteType.fields;
  const cardTypes = Array.isArray(raw.cardTypes)
    ? raw.cardTypes
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item, index) => {
          const legacyDeckId = typeof item.deckId === "string" && item.deckId ? item.deckId : null;
          const deckIds = Array.isArray(item.deckIds)
            ? item.deckIds
              .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
              .map((value) => value.trim())
            : legacyDeckId
              ? [legacyDeckId]
              : [];
          return {
            id: optionalString(item.id).trim() || `card-${index + 1}`,
            name: optionalString(item.name).trim(),
            deckIds,
            front: optionalString(item.front),
            back: optionalString(item.back),
          };
        })
    : defaults.noteType.cardTypes;
  return {
    name: optionalString(raw.name).trim() || defaults.noteType.name,
    fields,
    cardTypes,
  };
}

export function normalizeAnkiStructureConfig(value: unknown): AnkiStructureConfig {
  const defaults = createDefaultAnkiStructureConfig();
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const decks = normalizeDecks(input, defaults);
  const deckConfigs = normalizeDeckConfigs(input, defaults);
  const noteType = normalizeNoteType(input, defaults);
  const rawMove =
    input.moveCards && typeof input.moveCards === "object"
      ? (input.moveCards as Record<string, unknown>)
      : {};

  return {
    schemaVersion: 5,
    profileName:
      typeof input.profileName === "string" && input.profileName.trim()
        ? input.profileName.trim()
        : defaults.profileName,
    decks,
    deckConfigs,
    noteType,
    moveCards: {
      sourceDeckId:
        optionalString(rawMove.sourceDeckId) ||
        decks.find((deck) => deck.name === WordAnkiConstants.decks.default)?.id ||
        decks[0]?.id ||
        "",
      targetDeckId:
        optionalString(rawMove.targetDeckId) ||
        decks.find((deck) => deck.name === WordAnkiConstants.decks.tempRoot)?.id ||
        decks[1]?.id ||
        "",
    },
  };
}

function duplicateValues(values: string[]) {
  return Array.from(new Set(values.filter((value, index) => values.indexOf(value) !== index)));
}

function parseStudyStepsToMinutes(value: string) {
  const raw = value.trim();
  if (!raw) return { value: null as number | null, invalid: false };
  let finalStep = 0;
  for (const token of raw.split(/\s+/g)) {
    const match = /^(\d+(?:\.\d+)?)([smhd])$/i.exec(token);
    if (!match) return { value: null, invalid: true };
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const minutes = unit === "s" ? amount / 60 : unit === "m" ? amount : unit === "h" ? amount * 60 : amount * 1440;
    finalStep = minutes;
  }
  return { value: finalStep, invalid: false };
}

function parseStudyDays(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function validateAnkiStructureConfig(config: AnkiStructureConfig) {
  const errors: string[] = [];
  const deckIds = config.decks.map((deck) => deck.id.trim());
  const deckNames = config.decks.map((deck) => deck.name.trim());
  const configIds = config.deckConfigs.map((item) => item.id.trim());
  const configNames = config.deckConfigs.map((item) => item.configName.trim());
  const cardIds = config.noteType.cardTypes.map((item) => item.id.trim());
  const cardNames = config.noteType.cardTypes.map((item) => item.name.trim());
  const fields = config.noteType.fields.map((field) => field.trim());

  for (const [label, values] of [
    ["شناسه دک", deckIds],
    ["نام دک", deckNames],
    ["شناسه Deck Config", configIds],
    ["نام Deck Config", configNames],
    ["شناسه Card Type", cardIds],
    ["نام Card Type", cardNames],
    ["نام فیلد", fields],
  ] as const) {
    const duplicates = duplicateValues(values);
    if (duplicates.length) errors.push(`${label} تکراری است: ${duplicates.join("، ")}`);
  }

  config.decks.forEach((deck, index) => {
    if (!deck.id.trim()) errors.push(`شناسه دک ردیف ${index + 1} خالی است.`);
    if (!deck.title.trim()) errors.push(`عنوان دک ردیف ${index + 1} خالی است.`);
    if (!deck.name.trim()) errors.push(`نام دک ردیف ${index + 1} خالی است.`);
  });

  const deckIdSet = new Set(deckIds);
  const assignedDeckIds = config.deckConfigs.flatMap((item) => item.deckIds);
  const duplicateDeckAssignments = duplicateValues(assignedDeckIds);
  if (duplicateDeckAssignments.length) {
    const duplicateDeckNames = duplicateDeckAssignments.map(
      (deckId) => config.decks.find((deck) => deck.id === deckId)?.name ?? deckId,
    );
    errors.push(`هر دک فقط می‌تواند یک Deck Config داشته باشد: ${duplicateDeckNames.join("، ")}`);
  }
  config.deckConfigs.forEach((item, index) => {
    if (!item.id.trim()) errors.push(`شناسه Deck Config ردیف ${index + 1} خالی است.`);
    if (!item.configName.trim()) errors.push(`نام Deck Config ردیف ${index + 1} خالی است.`);
    if (item.deckIds.some((deckId) => !deckIdSet.has(deckId))) {
      errors.push(`دک Deck Config «${item.configName || index + 1}» معتبر نیست.`);
    }
    if (!Number.isFinite(item.newCardsPerDay) || item.newCardsPerDay < 0) {
      errors.push(`New cards/day در ${item.configName || index + 1} معتبر نیست.`);
    }
    if (!Number.isFinite(item.maximumReviewsPerDay) || item.maximumReviewsPerDay < 0) {
      errors.push(`Maximum reviews/day در ${item.configName || index + 1} معتبر نیست.`);
    }
    const intervalModifier = Number(item.intervalModifier);
    if (!item.intervalModifier.trim() || !Number.isFinite(intervalModifier) || intervalModifier <= 0) {
      errors.push(`Interval modifier در ${item.configName || index + 1} باید عددی بزرگ‌تر از صفر باشد.`);
    }

    const learningSteps = parseStudyStepsToMinutes(item.learningSteps);
    const relearningSteps = parseStudyStepsToMinutes(item.relearningSteps);
    const graduatingInterval = parseStudyDays(item.graduatingInterval);
    const easyInterval = parseStudyDays(item.easyInterval);
    const minimumInterval = parseStudyDays(item.minimumInterval);
    if (learningSteps.invalid) errors.push(`Learning steps در ${item.configName || index + 1} معتبر نیست.`);
    if (relearningSteps.invalid) errors.push(`Relearning steps در ${item.configName || index + 1} معتبر نیست.`);
    if (item.graduatingInterval.trim() && graduatingInterval === null) {
      errors.push(`Graduating interval در ${item.configName || index + 1} باید عدد روز معتبر باشد.`);
    }
    if (item.easyInterval.trim() && easyInterval === null) {
      errors.push(`Easy interval در ${item.configName || index + 1} باید عدد روز معتبر باشد.`);
    }
    if (item.minimumInterval.trim() && minimumInterval === null) {
      errors.push(`Minimum interval در ${item.configName || index + 1} باید عدد روز معتبر باشد.`);
    }
    if (graduatingInterval !== null && learningSteps.value !== null && graduatingInterval * 1440 < learningSteps.value) {
      errors.push(`Graduating interval در ${item.configName || index + 1} باید حداقل به اندازه آخرین Learning step باشد.`);
    }
    if (graduatingInterval !== null && easyInterval !== null && easyInterval < graduatingInterval) {
      errors.push(`Easy interval در ${item.configName || index + 1} باید حداقل به اندازه Graduating interval باشد.`);
    }
    if (minimumInterval !== null && relearningSteps.value !== null && minimumInterval * 1440 < relearningSteps.value) {
      errors.push(`Minimum interval در ${item.configName || index + 1} باید حداقل به اندازه آخرین Relearning step باشد.`);
    }
  });

  if (!config.noteType.name.trim()) errors.push("نام Note Type خالی است.");
  if (!fields.length) errors.push("Note Type باید حداقل یک فیلد داشته باشد.");
  fields.forEach((field, index) => {
    if (!field) errors.push(`نام فیلد ردیف ${index + 1} خالی است.`);
  });
  if (!config.noteType.cardTypes.length) errors.push("Note Type باید حداقل یک Card Type داشته باشد.");
  config.noteType.cardTypes.forEach((card, index) => {
    if (!card.id.trim()) errors.push(`شناسه Card Type ردیف ${index + 1} خالی است.`);
    if (!card.name.trim()) errors.push(`نام Card Type ردیف ${index + 1} خالی است.`);
    if (card.deckIds.some((deckId) => !deckIdSet.has(deckId))) errors.push(`دک Card Type «${card.name || index + 1}» معتبر نیست.`);
    if (!card.front.trim()) errors.push(`Front مربوط به Card Type «${card.name || index + 1}» خالی است.`);
    if (!card.back.trim()) errors.push(`Back مربوط به Card Type «${card.name || index + 1}» خالی است.`);
  });

  if (!deckIdSet.has(config.moveCards.sourceDeckId)) errors.push("دک مبدأ انتقال امن معتبر نیست.");
  if (!deckIdSet.has(config.moveCards.targetDeckId)) errors.push("دک مقصد انتقال امن معتبر نیست.");
  if (config.moveCards.sourceDeckId === config.moveCards.targetDeckId) errors.push("دک مبدأ و مقصد انتقال امن نباید یکسان باشند.");
  return errors;
}

export function createStructureId(prefix: "deck" | "config" | "card") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function findStructureDeck(config: AnkiStructureConfig, deckId: string | null | undefined) {
  return config.decks.find((deck) => deck.id === deckId) ?? null;
}
