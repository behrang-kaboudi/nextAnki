import { WordDeckByCardType, WordDeckConfigs } from "./deck/constants";
import { AnkiNoteTypes, WordAnkiConstants } from "./deck/notes";

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
  "Emla",
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
  "WordsForNewStudyEmla",
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
  WordsForNewStudyEmla: "Emla",
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
  deckId: string;
  configName: string;
  newCardsPerDay: number;
  maximumReviewsPerDay: number;
  learningSteps: string;
  relearningSteps: string;
  startingEase: string;
  easyBonus: string;
  graduatingInterval: string;
  easyInterval: string;
};

export type AnkiStructureCardType = {
  id: string;
  name: string;
  deckId: string | null;
  front: string;
  back: string;
};

export type AnkiStructureNoteType = {
  name: string;
  fields: string[];
  cardTypes: AnkiStructureCardType[];
};

export type AnkiStructureConfig = {
  schemaVersion: 2;
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
    Emla: "املا",
    Rahnama: "راهنمای اول",
    Rahnama2: "راهنمای دوم",
  };
  return titles[key];
}

function defaultDeckConfig(key: LegacyConfigKey): EditableDeckConfig {
  const source = WordDeckConfigs[key] as Record<string, unknown>;
  return {
    id: `config-${key}`,
    deckId: `deck-${legacyConfigDeckMap[key]}`,
    configName: key,
    newCardsPerDay: Number(source.newCardsPerDay),
    maximumReviewsPerDay: Number(source.maximumReviewsPerDay),
    learningSteps: optionalString(source.learningSteps),
    relearningSteps: optionalString(source.RelearningSteps ?? source.relearningSteps),
    startingEase: optionalString(source.StartingEase ?? source.startingEase),
    easyBonus: optionalString(source.EasyBonus ?? source.easyBonus),
    graduatingInterval: optionalString(source.graduatingInterval ?? source.GraduatingInterval),
    easyInterval: optionalString(source.easyInterval ?? source.EasyInterval),
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
  const cardTypes = Object.entries(WordAnkiConstants.noteTemplates).map(([name, template]) => ({
    id: `card-${name}`,
    name,
    deckId:
      deckIdByName.get(
        WordDeckByCardType[name as keyof typeof WordDeckByCardType] ?? "",
      ) ?? null,
    front: template.Front,
    back: template.Back,
  }));

  return {
    schemaVersion: 2,
    profileName: "پروفایل اصلی",
    decks,
    deckConfigs: legacyConfigKeys.map(defaultDeckConfig),
    noteType: {
      name: AnkiNoteTypes.META_LEX_VR9,
      fields: WordAnkiConstants.noteFields.map(String),
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
  const text = (field: keyof EditableDeckConfig) =>
    typeof item[field] === "string" ? item[field].trim() : String(fallback[field]);
  return {
    id: text("id") || `config-${index + 1}`,
    deckId: text("deckId"),
    configName: text("configName"),
    newCardsPerDay: finiteNumber(item.newCardsPerDay, fallback.newCardsPerDay),
    maximumReviewsPerDay: finiteNumber(item.maximumReviewsPerDay, fallback.maximumReviewsPerDay),
    learningSteps: text("learningSteps"),
    relearningSteps: text("relearningSteps"),
    startingEase: text("startingEase"),
    easyBonus: text("easyBonus"),
    graduatingInterval: text("graduatingInterval"),
    easyInterval: text("easyInterval"),
  };
}

function normalizeDeckConfigs(input: Record<string, unknown>, defaults: AnkiStructureConfig) {
  if (Array.isArray(input.deckConfigs)) {
    return input.deckConfigs
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item, index) =>
        normalizeDeckConfigItem(item, defaults.deckConfigs[index] ?? {
          id: `config-${index + 1}`,
          deckId: "",
          configName: "",
          newCardsPerDay: 20,
          maximumReviewsPerDay: 200,
          learningSteps: "1m 10m",
          relearningSteps: "10m",
          startingEase: "2.50",
          easyBonus: "1.3",
          graduatingInterval: "1",
          easyInterval: "4",
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

function normalizeNoteType(input: Record<string, unknown>, defaults: AnkiStructureConfig) {
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
        .map((item, index) => ({
          id: optionalString(item.id).trim() || `card-${index + 1}`,
          name: optionalString(item.name).trim(),
          deckId: typeof item.deckId === "string" && item.deckId ? item.deckId : null,
          front: optionalString(item.front),
          back: optionalString(item.back),
        }))
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
    schemaVersion: 2,
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
  config.deckConfigs.forEach((item, index) => {
    if (!item.id.trim()) errors.push(`شناسه Deck Config ردیف ${index + 1} خالی است.`);
    if (!item.configName.trim()) errors.push(`نام Deck Config ردیف ${index + 1} خالی است.`);
    if (!deckIdSet.has(item.deckId)) errors.push(`دک Deck Config «${item.configName || index + 1}» معتبر نیست.`);
    if (!Number.isFinite(item.newCardsPerDay) || item.newCardsPerDay < 0) {
      errors.push(`New cards/day در ${item.configName || index + 1} معتبر نیست.`);
    }
    if (!Number.isFinite(item.maximumReviewsPerDay) || item.maximumReviewsPerDay < 0) {
      errors.push(`Maximum reviews/day در ${item.configName || index + 1} معتبر نیست.`);
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
    if (card.deckId && !deckIdSet.has(card.deckId)) errors.push(`دک Card Type «${card.name || index + 1}» معتبر نیست.`);
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
