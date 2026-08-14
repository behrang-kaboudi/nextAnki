import {
  ankiOperations,
  quoteAnkiSearchValue,
} from "@/lib/anki";
import {
  findStructureDeck,
  type AnkiStructureConfig,
} from "@/lib/anki/structureSettings";

import { asNumber, getPerDay } from "./deckConfigHelpers";
import { requiredDecksFromConfig } from "./ensureDecks";
import type { StructureStepStatus } from "./types";

export type StructureInspection = {
  connected: boolean;
  checkedAt: string;
  version: number | null;
  differenceCount: number | null;
  differences: string[];
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
      differenceCount: null,
      differences: [],
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
  const differences = missingDecks.map((deck) => `دک «${deck}» هنوز در Anki ساخته نشده است.`);
  initialSteps[1] = missingDecks.length
    ? needsChange(`${missingDecks.length} دک ساخته نشده است.`)
    : ready(`هر ${requiredDecks.length} دک موجود است.`);

  const configDifferences: string[] = [];
  for (const desired of config.deckConfigs) {
    for (const deckId of desired.deckIds) {
      const deck = findStructureDeck(config, deckId);
      if (!deck) {
        configDifferences.push(`دکِ متصل به Config «${desired.configName}» در تنظیمات پیدا نشد.`);
        continue;
      }
      if (!deckNames.has(deck.name)) {
        configDifferences.push(`دک «${deck.name}» پس از ساخته‌شدن باید به Config «${desired.configName}» متصل شود.`);
        continue;
      }
      const currentRes = await ankiOperations.getDeckConfig({ deck: deck.name });
      const current = currentRes.ok ? currentRes.result : null;
      if (!current) {
        configDifferences.push(`Config فعلی دک «${deck.name}» از Anki خوانده نشد.`);
        continue;
      }
      if (current.name !== desired.configName) {
        configDifferences.push(`دک «${deck.name}» از Config «${current.name}» استفاده می‌کند؛ مقدار ذخیره‌شده «${desired.configName}» است.`);
      }
      if (getPerDay(current.new) !== desired.newCardsPerDay) {
        configDifferences.push(`تعداد کارت جدید روزانهٔ دک «${deck.name}» با مقدار ذخیره‌شده متفاوت است.`);
      }
      if (getPerDay(current.rev) !== desired.maximumReviewsPerDay) {
        configDifferences.push(`حداکثر مرور روزانهٔ دک «${deck.name}» با مقدار ذخیره‌شده متفاوت است.`);
      }
      if (desired.easyBonus.trim() && asNumber(current.rev?.ease4) !== Number(desired.easyBonus)) {
        configDifferences.push(`Easy Bonus دک «${deck.name}» با مقدار ذخیره‌شده متفاوت است.`);
      }
      if (
        desired.intervalModifier.trim() &&
        (asNumber(current.rev?.ivlFct) ?? asNumber(current.rev?.ivl_fct)) !== Number(desired.intervalModifier)
      ) {
        configDifferences.push(`Interval Modifier دک «${deck.name}» با مقدار ذخیره‌شده متفاوت است.`);
      }
    }
  }
  differences.push(...configDifferences);
  initialSteps[2] = configDifferences.length
    ? needsChange(`${configDifferences.length} مورد از Deck Configها نیاز به هماهنگ‌سازی دارد.`)
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
  if (!modelExists) {
    differences.push(`Note Type «${modelName}» در Anki وجود ندارد.`);
  } else {
    differences.push(
      ...missingTemplates.map((name) => `Card Type «${name}» در Anki وجود ندارد.`),
      ...extraTemplates.map((name) => `Card Type اضافی «${name}» در Anki وجود دارد.`),
    );
  }
  initialSteps[3] = !modelExists
    ? needsChange(`Note Type با نام ${modelName} وجود ندارد.`)
    : missingTemplates.length || extraTemplates.length
      ? needsChange(
          `${missingTemplates.length} Card Type کم و ${extraTemplates.length} Card Type اضافه است.`,
        )
      : ready(`هر ${desiredTemplateNames.length} Card Type موجود است.`);

  const desiredFields = config.noteType.fields;
  const fieldDifferenceCount = Math.max(fields?.length ?? 0, desiredFields.length) === 0
    ? 0
    : Array.from(
        { length: Math.max(fields?.length ?? 0, desiredFields.length) },
        (_, index) => fields?.[index] !== desiredFields[index],
      ).filter(Boolean).length;
  const fieldMatches =
    Boolean(fields) &&
    fieldDifferenceCount === 0;
  if (modelExists && !fieldMatches) {
    const maximumFieldCount = Math.max(fields?.length ?? 0, desiredFields.length);
    for (let index = 0; index < maximumFieldCount; index += 1) {
      if (fields?.[index] !== desiredFields[index]) {
        differences.push(
          `فیلد شمارهٔ ${(index + 1).toLocaleString("fa-IR")} در Anki «${fields?.[index] ?? "وجود ندارد"}» است؛ مقدار ذخیره‌شده «${desiredFields[index] ?? "نباید وجود داشته باشد"}» است.`,
        );
      }
    }
  }
  initialSteps[4] = fieldMatches
    ? ready(`هر ${desiredFields.length} فیلد با ترتیب درست موجود است.`)
    : needsChange("فیلدها یا ترتیب آن‌ها با تعریف برنامه متفاوت است.");

  const changedTemplates = desiredTemplateNames.filter((name) => {
    const current = templates?.[name];
    const desired = desiredTemplates[name];
    return !current || current.Front !== desired.Front || current.Back !== desired.Back;
  });
  if (modelExists) {
    differences.push(
      ...changedTemplates
        .filter((name) => templates?.[name])
        .map((name) => `محتوای Template مربوط به Card Type «${name}» متفاوت است.`),
    );
  }
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
  if (defaultCount) {
    differences.push(`${defaultCount.toLocaleString("fa-IR")} کارت باید از دک «${defaultDeck}» به دک موقت منتقل شود.`);
  }

  return {
    connected: true,
    checkedAt,
    version: Number(versionRes.result),
    differenceCount: differences.length,
    differences,
    steps: initialSteps,
  };
}
