import "server-only";

import { createAnkiConnectClient } from "@/lib/AnkiConnect";

const DECK_NAME = "enSenteses";
const MODEL_NAME = "enSenteses";
const FIELD_NAMES = [
  "sentence_en",
  "sentence_en_sound",
  "sentence_en_meaning_fa",
  "sentence_en_meaning_fa_sound",
  "updatedAt",
] as const;

const CARD_TEMPLATE = {
  Name: "Sentence",
  Front: `
<div>{{sentence_en}}</div>
<div>{{sentence_en_sound}}</div>
`.trim(),
  Back: `
{{FrontSide}}
<hr id=answer>
<div>{{sentence_en_meaning_fa}}</div>
<div>{{sentence_en_meaning_fa_sound}}</div>
<div>{{updatedAt}}</div>
`.trim(),
};

export async function ensureEnSentesesAnkiSetup() {
  const anki = createAnkiConnectClient({ timeoutMs: 15_000, retryDelayMs: 750 });

  const permRes = await anki.requestDetailed("requestPermission");
  if (!permRes.ok) throw new Error(`AnkiConnect requestPermission failed: ${permRes.error}`);
  if (!permRes.result) throw new Error("AnkiConnect returned null for requestPermission.");
  if (permRes.result.permission !== "granted") {
    throw new Error("Permission denied in AnkiConnect settings.");
  }

  const deckNamesRes = await anki.requestDetailed("deckNames");
  if (!deckNamesRes.ok) throw new Error(`AnkiConnect deckNames failed: ${deckNamesRes.error}`);
  const deckNames = deckNamesRes.result;
  if (!deckNames) throw new Error("AnkiConnect returned null for deckNames.");

  let deckCreated = false;
  if (!deckNames.includes(DECK_NAME)) {
    const createDeckRes = await anki.requestDetailed("createDeck", { deck: DECK_NAME });
    if (!createDeckRes.ok) throw new Error(`AnkiConnect createDeck failed: ${createDeckRes.error}`);
    deckCreated = true;
  }

  const modelNamesRes = await anki.requestDetailed("modelNames");
  if (!modelNamesRes.ok) throw new Error(`AnkiConnect modelNames failed: ${modelNamesRes.error}`);
  const modelNames = modelNamesRes.result;
  if (!modelNames) throw new Error("AnkiConnect returned null for modelNames.");

  let modelCreated = false;
  const addedFields: string[] = [];

  if (!modelNames.includes(MODEL_NAME)) {
    const createModelRes = await anki.requestDetailed("createModel", {
      modelName: MODEL_NAME,
      inOrderFields: [...FIELD_NAMES],
      cardTemplates: [CARD_TEMPLATE],
    });
    if (!createModelRes.ok) throw new Error(`AnkiConnect createModel failed: ${createModelRes.error}`);
    modelCreated = true;
  } else {
    const fieldNamesRes = await anki.requestDetailed("modelFieldNames", { modelName: MODEL_NAME });
    if (!fieldNamesRes.ok) {
      throw new Error(`AnkiConnect modelFieldNames failed: ${fieldNamesRes.error}`);
    }
    const currentFields = fieldNamesRes.result;
    if (!currentFields) throw new Error("AnkiConnect returned null for modelFieldNames.");

    for (const fieldName of FIELD_NAMES) {
      if (currentFields.includes(fieldName)) continue;
      const addFieldRes = await anki.requestDetailed("modelFieldAdd", {
        modelName: MODEL_NAME,
        fieldName,
      });
      if (!addFieldRes.ok) {
        throw new Error(`AnkiConnect modelFieldAdd failed for ${fieldName}: ${addFieldRes.error}`);
      }
      addedFields.push(fieldName);
    }

    for (let index = 0; index < FIELD_NAMES.length; index += 1) {
      const fieldName = FIELD_NAMES[index];
      const repositionRes = await anki.requestDetailed("modelFieldReposition", {
        modelName: MODEL_NAME,
        fieldName,
        index,
      });
      if (!repositionRes.ok) {
        throw new Error(
          `AnkiConnect modelFieldReposition failed for ${fieldName}: ${repositionRes.error}`,
        );
      }
    }
  }

  return {
    deckName: DECK_NAME,
    modelName: MODEL_NAME,
    fields: [...FIELD_NAMES],
    deckCreated,
    modelCreated,
    addedFields,
  };
}
