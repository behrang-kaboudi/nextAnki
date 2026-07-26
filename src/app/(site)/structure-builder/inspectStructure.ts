import {
  ankiOperations,
  quoteAnkiSearchValue,
} from "@/lib/anki";
import {
  findStructureDeck,
  type AnkiStructureConfig,
} from "@/lib/anki/structureSettings";

import { getPerDay } from "./deckConfigHelpers";
import { requiredDecksFromConfig } from "./ensureDecks";
import type { StructureStepStatus } from "./types";

export type StructureInspection = {
  connected: boolean;
  checkedAt: string;
  version: number | null;
  steps: Record<number, StructureStepStatus>;
};

function needsChange(detail: string): StructureStepStatus {
  return { state: "needs-change", detail };
}

function ready(detail: string): StructureStepStatus {
  return { state: "ready", detail };
}

export async function inspectAnkiStructure(config: AnkiStructureConfig): Promise<StructureInspection> {
  const checkedAt = new Date().toISOString();
  const initialSteps = Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [
      index + 1,
      { state: "checking", detail: "در حال بررسی…" } satisfies StructureStepStatus,
    ]),
  ) as Record<number, StructureStepStatus>;

  const versionRes = await ankiOperations.version();
  if (!versionRes.ok || versionRes.result === null) {
    return {
      connected: false,
      checkedAt,
      version: null,
      steps: Object.fromEntries(
        Object.keys(initialSteps).map((key) => [
          Number(key),
          { state: "idle", detail: "برای بررسی، Anki و AnkiConnect را باز کنید." },
        ]),
      ) as Record<number, StructureStepStatus>,
    };
  }

  const deckNamesRes = await ankiOperations.deckNames();
  const deckNames = new Set(deckNamesRes.ok && deckNamesRes.result ? deckNamesRes.result : []);
  const requiredDecks = requiredDecksFromConfig(config);
  const missingDecks = requiredDecks.filter((deck) => !deckNames.has(deck));
  initialSteps[1] = missingDecks.length
    ? needsChange(`${missingDecks.length} دک ساخته نشده است.`)
    : ready(`هر ${requiredDecks.length} دک موجود است.`);

  const configMismatches: string[] = [];
  for (const desired of config.deckConfigs) {
    const deck = findStructureDeck(config, desired.deckId);
    if (!deck || !deckNames.has(deck.name)) {
      configMismatches.push(desired.configName);
      continue;
    }
    const currentRes = await ankiOperations.getDeckConfig({ deck: deck.name });
    const current = currentRes.ok ? currentRes.result : null;
    if (
      !current ||
      current.name !== desired.configName ||
      getPerDay(current.new) !== desired.newCardsPerDay ||
      getPerDay(current.rev) !== desired.maximumReviewsPerDay
    ) {
      configMismatches.push(desired.configName);
    }
  }
  initialSteps[2] = configMismatches.length
    ? needsChange(`${configMismatches.length} Deck Config نیاز به هماهنگ‌سازی دارد.`)
    : ready("Deck Configهای اصلی هماهنگ هستند.");

  const modelName = config.noteType.name;
  const modelNamesRes = await ankiOperations.modelNames();
  const modelExists = Boolean(modelNamesRes.ok && modelNamesRes.result?.includes(modelName));
  let templates: Record<string, { Front: string; Back: string }> | null = null;
  let fields: string[] | null = null;
  if (modelExists) {
    const [templatesRes, fieldsRes] = await Promise.all([
      ankiOperations.modelTemplates({ modelName }),
      ankiOperations.modelFieldNames({ modelName }),
    ]);
    templates = templatesRes.ok ? templatesRes.result : null;
    fields = fieldsRes.ok ? fieldsRes.result : null;
  }

  const desiredTemplates = Object.fromEntries(
    config.noteType.cardTypes.map((template) => [
      template.name,
      { Front: template.front, Back: template.back },
    ]),
  );
  const desiredTemplateNames = config.noteType.cardTypes.map((template) => template.name);
  const missingTemplates = desiredTemplateNames.filter((name) => !templates?.[name]);
  const extraTemplates = Object.keys(templates ?? {}).filter(
    (name) => !desiredTemplateNames.includes(name),
  );
  initialSteps[3] = !modelExists
    ? needsChange(`Note Type با نام ${modelName} وجود ندارد.`)
    : missingTemplates.length || extraTemplates.length
      ? needsChange(
          `${missingTemplates.length} Card Type کم و ${extraTemplates.length} Card Type اضافه است.`,
        )
      : ready(`هر ${desiredTemplateNames.length} Card Type موجود است.`);

  const desiredFields = config.noteType.fields;
  const fieldMatches =
    Boolean(fields) &&
    fields?.length === desiredFields.length &&
    fields.every((field, index) => field === desiredFields[index]);
  initialSteps[4] = fieldMatches
    ? ready(`هر ${desiredFields.length} فیلد با ترتیب درست موجود است.`)
    : needsChange("فیلدها یا ترتیب آن‌ها با تعریف برنامه متفاوت است.");

  const changedTemplates = desiredTemplateNames.filter((name) => {
    const current = templates?.[name];
    const desired = desiredTemplates[name];
    return !current || current.Front !== desired.Front || current.Back !== desired.Back;
  });
  initialSteps[5] = changedTemplates.length
    ? needsChange(`${changedTemplates.length} Template نیاز به به‌روزرسانی دارد.`)
    : ready("محتوای Templateها هماهنگ است.");

  const defaultDeck =
    findStructureDeck(config, config.moveCards.sourceDeckId)?.name ?? "";
  const findDefaultRes = await ankiOperations.findCards({
    query: [
      `note:${quoteAnkiSearchValue(modelName)}`,
      `deck:${quoteAnkiSearchValue(defaultDeck)}`,
    ].join(" "),
  });
  const defaultCount = findDefaultRes.ok ? (findDefaultRes.result?.length ?? 0) : 0;
  initialSteps[6] = defaultCount
    ? needsChange(`${defaultCount} کارت از این Note Type داخل ${defaultDeck} است.`)
    : ready(`کارتی از این Note Type داخل ${defaultDeck} نیست.`);

  return {
    connected: true,
    checkedAt,
    version: Number(versionRes.result),
    steps: initialSteps,
  };
}
