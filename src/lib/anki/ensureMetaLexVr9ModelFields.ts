import "server-only";

import { createAnkiConnectClient } from "@/lib/anki";
import { AnkiNoteTypes } from "@/lib/anki";
import { getAnkiStructureSettings } from "@/lib/anki/structureSettingsRepo";

export async function ensureMetaLexVr9ModelFields(
  anki: ReturnType<typeof createAnkiConnectClient>,
) {
  const permRes = await anki.requestDetailed("requestPermission");
  if (!permRes.ok) throw new Error(permRes.error);
  if (!permRes.result)
    throw new Error("AnkiConnect returned null for requestPermission.");
  if (permRes.result.permission !== "granted") {
    throw new Error("Permission denied in AnkiConnect settings.");
  }

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  // Structure Builder is the source of truth for the templates. The repository
  // returns code defaults when no profile has ever been saved, but a persisted
  // profile must not have its deleted Card Types resurrected by Full Sync.
  const structureSettings = await getAnkiStructureSettings();
  const desiredFields = structureSettings.config.noteType.fields
    .slice()
    .map(String);
  const desiredTemplates = Object.fromEntries(
    structureSettings.config.noteType.cardTypes.map((template) => [
      template.name,
      { Front: template.front, Back: template.back },
    ]),
  );

  const modelNamesRes = await anki.requestDetailed("modelNames");
  if (!modelNamesRes.ok) throw new Error(modelNamesRes.error);
  const modelNames = modelNamesRes.result;
  if (!modelNames) throw new Error("AnkiConnect returned null for modelNames.");

  if (!modelNames.includes(modelName)) {
    const cardTemplates = Object.entries(desiredTemplates).map(
      ([Name, template]) => ({
        Name,
        Front: template.Front,
        Back: template.Back,
      }),
    );

    const createRes = await anki.requestDetailed("createModel", {
      modelName,
      inOrderFields: desiredFields,
      cardTemplates,
    });
    if (!createRes.ok) throw new Error(createRes.error);
    return;
  }

  const fieldNamesRes = await anki.requestDetailed("modelFieldNames", {
    modelName,
  });
  if (!fieldNamesRes.ok) throw new Error(fieldNamesRes.error);
  const currentFields = fieldNamesRes.result;
  if (!currentFields)
    throw new Error("AnkiConnect returned null for modelFieldNames.");

  for (const f of desiredFields) {
    if (currentFields.includes(f)) continue;
    const addRes = await anki.requestDetailed("modelFieldAdd", {
      modelName,
      fieldName: f,
    });
    if (!addRes.ok) throw new Error(addRes.error);
  }

  // Structure Builder is authoritative. Remove fields that were explicitly
  // removed there so Full Sync cannot leave a stale parallel schema in Anki.
  for (const fieldName of currentFields) {
    if (desiredFields.includes(fieldName)) continue;
    const removeRes = await anki.requestDetailed("modelFieldRemove", {
      modelName,
      fieldName,
    });
    if (!removeRes.ok) throw new Error(removeRes.error);
  }

  const reorderedFieldsRes = await anki.requestDetailed("modelFieldNames", {
    modelName,
  });
  if (!reorderedFieldsRes.ok) throw new Error(reorderedFieldsRes.error);
  const reorderedFields = reorderedFieldsRes.result?.slice() ?? [];
  for (let index = 0; index < desiredFields.length; index += 1) {
    const fieldName = desiredFields[index]!;
    if (reorderedFields[index] === fieldName) continue;
    const repositionRes = await anki.requestDetailed("modelFieldReposition", {
      modelName,
      fieldName,
      index,
    });
    if (!repositionRes.ok) throw new Error(repositionRes.error);
    const previousIndex = reorderedFields.indexOf(fieldName);
    if (previousIndex >= 0) reorderedFields.splice(previousIndex, 1);
    reorderedFields.splice(index, 0, fieldName);
  }

  // Keep card templates in sync as well (especially important for existing users/models).
  const currentTemplatesRes = await anki.requestDetailed("modelTemplates", {
    modelName,
  });
  if (!currentTemplatesRes.ok) throw new Error(currentTemplatesRes.error);
  const currentTemplates = currentTemplatesRes.result;
  if (!currentTemplates)
    throw new Error("AnkiConnect returned null for modelTemplates.");

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
  for (const templateName of Object.keys(currentTemplates)) {
    if (Object.hasOwn(desiredTemplates, templateName)) continue;
    const removeRes = await anki.requestDetailed("modelTemplateRemove", {
      modelName,
      templateName,
    });
    if (!removeRes.ok) throw new Error(removeRes.error);
  }
}
