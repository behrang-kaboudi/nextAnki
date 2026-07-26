import "server-only";

import { createAnkiConnectClient } from "@/lib/anki";
import { AnkiNoteTypes, WordAnkiConstants } from "@/lib/anki";

export async function ensureMetaLexVr9ModelFields(
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const permRes = await anki.requestDetailed("requestPermission");
  if (!permRes.ok) throw new Error(permRes.error);
  if (!permRes.result) throw new Error("AnkiConnect returned null for requestPermission.");
  if (permRes.result.permission !== "granted") {
    throw new Error("Permission denied in AnkiConnect settings.");
  }

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  const desiredFields = WordAnkiConstants.noteFields.slice().map(String);

  const modelNamesRes = await anki.requestDetailed("modelNames");
  if (!modelNamesRes.ok) throw new Error(modelNamesRes.error);
  const modelNames = modelNamesRes.result;
  if (!modelNames) throw new Error("AnkiConnect returned null for modelNames.");

  if (!modelNames.includes(modelName)) {
    const templates = WordAnkiConstants.noteTemplates;
    const cardTemplates = Object.entries(templates).map(([Name, template]) => ({
      Name,
      Front: template.Front,
      Back: template.Back,
    }));

    const createRes = await anki.requestDetailed("createModel", {
      modelName,
      inOrderFields: desiredFields,
      cardTemplates,
    });
    if (!createRes.ok) throw new Error(createRes.error);
    return;
  }

  const fieldNamesRes = await anki.requestDetailed("modelFieldNames", { modelName });
  if (!fieldNamesRes.ok) throw new Error(fieldNamesRes.error);
  const currentFields = fieldNamesRes.result;
  if (!currentFields) throw new Error("AnkiConnect returned null for modelFieldNames.");

  for (const f of desiredFields) {
    if (currentFields.includes(f)) continue;
    const addRes = await anki.requestDetailed("modelFieldAdd", { modelName, fieldName: f });
    if (!addRes.ok) throw new Error(addRes.error);
  }

  // Keep card templates in sync as well (especially important for existing users/models).
  const desiredTemplates = WordAnkiConstants.noteTemplates;

  const currentTemplatesRes = await anki.requestDetailed("modelTemplates", { modelName });
  if (!currentTemplatesRes.ok) throw new Error(currentTemplatesRes.error);
  const currentTemplates = currentTemplatesRes.result;
  if (!currentTemplates) throw new Error("AnkiConnect returned null for modelTemplates.");

  const updates: Record<string, { Front: string; Back: string }> = {};
  for (const [name, desired] of Object.entries(desiredTemplates)) {
    const current = currentTemplates[name] ?? null;
    if (!current) {
      const addRes = await anki.requestDetailed("modelTemplateAdd", {
        modelName,
        template: { Name: name, Front: desired.Front, Back: desired.Back },
      });
      if (!addRes.ok) throw new Error(addRes.error);
      continue;
    }

    if (current.Front !== desired.Front || current.Back !== desired.Back) {
      updates[name] = { Front: desired.Front, Back: desired.Back };
    }
  }

  if (Object.keys(updates).length) {
    const updateRes = await anki.requestDetailed("updateModelTemplates", {
      model: { name: modelName, templates: updates },
    });
    if (!updateRes.ok) throw new Error(updateRes.error);
  }
}
