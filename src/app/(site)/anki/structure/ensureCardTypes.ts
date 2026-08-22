import { AnkiNoteTypes, createAnkiOperations } from "@/lib/anki";
import { createDefaultAnkiStructureConfig, DEFAULT_WORD_NOTE_FIELDS, type AnkiStructureConfig, type AnkiStructureCardType } from "@/lib/anki/structureSettings";

import { ensureAnkiPermission } from "./ensureNoteType";
import type { LogFn, StepResult } from "./types";

const cardTypeOperations = createAnkiOperations({ timeoutMs: 200_000 });

function desiredCardTemplates(config?: AnkiStructureConfig) {
  if (config) {
    return config.noteType.cardTypes.map((template) => ({
      Name: template.name,
      Front: template.front,
      Back: template.back,
    }));
  }
  return createDefaultAnkiStructureConfig().noteType.cardTypes.map((template) => ({
    Name: template.name,
    Front: template.front,
    Back: template.back,
  }));
}

async function createModelWithCardTypes(
  modelName: string,
  fields: string[],
  cardTypes: AnkiStructureCardType[] | null,
  appendLog: LogFn,
): Promise<StepResult> {
  appendLog(`Note Type ${modelName} does not exist.`);
  appendLog("Creating the Note Type and all required Card Types...");

  const createRes = await cardTypeOperations.createModel({
    modelName,
    inOrderFields: fields,
    cardTemplates: cardTypes
      ? cardTypes.map((template) => ({
          Name: template.name,
          Front: template.front,
          Back: template.back,
        }))
      : desiredCardTemplates(),
  });
  if (!createRes.ok) {
    appendLog(`✗ createModel failed: ${createRes.error}`);
    return { ok: false };
  }

  appendLog("✓ Note Type and all required Card Types created.");
  return { ok: true };
}

async function addMissingCardTypes(
  modelName: string,
  missingNames: string[],
  templates: Record<string, { Front: string; Back: string }>,
  appendLog: LogFn,
): Promise<StepResult> {
  for (const name of missingNames) {
    const template = templates[name];
    appendLog(`Creating Card Type: ${name} ...`);
    const addRes = await cardTypeOperations.modelTemplateAdd({
      modelName,
      template: { Name: name, Front: template.Front, Back: template.Back },
    });
    if (!addRes.ok) {
      appendLog(`✗ modelTemplateAdd failed for ${name}: ${addRes.error}`);
      return { ok: false };
    }
    appendLog(`✓ Created Card Type: ${name}`);
  }

  return { ok: true };
}

async function addFieldsRequiredByCardTypes(
  modelName: string,
  desiredFields: string[],
  appendLog: LogFn,
): Promise<StepResult> {
  const fieldsRes = await cardTypeOperations.modelFieldNames({ modelName });
  if (!fieldsRes.ok || !fieldsRes.result) {
    appendLog(`✗ modelFieldNames failed: ${fieldsRes.ok ? "null result" : fieldsRes.error}`);
    return { ok: false };
  }

  const currentFields = fieldsRes.result;
  const missingFields = desiredFields.filter((fieldName) => !currentFields.includes(fieldName));
  if (missingFields.length === 0) {
    appendLog("✓ All fields required by Card Types already exist.");
    return { ok: true };
  }

  appendLog(`Adding fields required by Card Types first (${missingFields.length}): ${missingFields.join(", ")}`);
  for (const fieldName of missingFields) {
    const addRes = await cardTypeOperations.modelFieldAdd({ modelName, fieldName });
    if (!addRes.ok) {
      appendLog(`✗ modelFieldAdd failed for ${fieldName}: ${addRes.error}`);
      return { ok: false };
    }
    appendLog(`✓ Added required field: ${fieldName}`);
  }

  return { ok: true };
}

async function removeExtraCardTypes(
  modelName: string,
  extraNames: string[],
  appendLog: LogFn,
): Promise<StepResult> {
  for (const name of extraNames) {
    appendLog(`Removing extra Card Type: ${name} ...`);
    const removeRes = await cardTypeOperations.modelTemplateRemove({
      modelName,
      templateName: name,
    });
    if (!removeRes.ok) {
      appendLog(`✗ modelTemplateRemove failed for ${name}: ${removeRes.error}`);
      return { ok: false };
    }
    appendLog(`✓ Removed Card Type: ${name}`);
  }
  return { ok: true };
}

async function renameCardTypes(
  modelName: string,
  renames: Array<{ oldName: string; newName: string }>,
  appendLog: LogFn,
): Promise<StepResult> {
  for (const rename of renames) {
    appendLog(`Renaming Card Type: ${rename.oldName} → ${rename.newName} ...`);
    const renameRes = await cardTypeOperations.modelTemplateRename({
      modelName,
      oldTemplateName: rename.oldName,
      newTemplateName: rename.newName,
    });
    if (!renameRes.ok) {
      appendLog(`✗ modelTemplateRename failed for ${rename.oldName}: ${renameRes.error}`);
      return { ok: false };
    }
    appendLog(`✓ Renamed Card Type: ${rename.oldName} → ${rename.newName}`);
  }
  return { ok: true };
}

async function confirmAllCardTypesExist(modelName: string, desiredNames: string[], appendLog: LogFn) {
  const confirmRes = await cardTypeOperations.modelTemplates({ modelName });
  if (!confirmRes.ok || !confirmRes.result) {
    appendLog(`✗ Could not confirm Card Types: ${confirmRes.ok ? "null result" : confirmRes.error}`);
    return { ok: false as const };
  }

  const confirmedNames = new Set(Object.keys(confirmRes.result));
  const stillMissing = desiredNames.filter((name) => !confirmedNames.has(name));
  const stillExtra = [...confirmedNames].filter((name) => !desiredNames.includes(name));
  if (stillMissing.length > 0) {
    appendLog(`✗ Card Types still missing: ${stillMissing.join(", ")}`);
    return { ok: false as const };
  }
  if (stillExtra.length > 0) {
    appendLog(`✗ Extra Card Types still exist: ${stillExtra.join(", ")}`);
    return { ok: false as const };
  }

  appendLog(`✓ Confirmed the exact set of ${desiredNames.length} Card Types.`);
  return { ok: true as const };
}

export async function ensureMetaLexVr9CardTypes(
  appendLog: LogFn,
  config?: AnkiStructureConfig,
): Promise<StepResult> {
  const modelName = config?.noteType.name ?? AnkiNoteTypes.META_LEX_VR9;
  const desiredTemplates = Object.fromEntries(
    desiredCardTemplates(config).map((template) => [
      template.Name,
      { Front: template.Front, Back: template.Back },
    ]),
  );
  const desiredNames = Object.keys(desiredTemplates);
  appendLog(`Step 3: Ensure Card Types for ${modelName}...`);
  appendLog(`Target Note Type: ${modelName}`);
  appendLog(`Required Card Types (${desiredNames.length}): ${desiredNames.join(", ")}`);

  const permissionResult = await ensureAnkiPermission(appendLog);
  if (!permissionResult.ok) return permissionResult;

  const modelNamesRes = await cardTypeOperations.modelNames();
  if (!modelNamesRes.ok || !modelNamesRes.result) {
    appendLog(`✗ modelNames failed: ${modelNamesRes.ok ? "null result" : modelNamesRes.error}`);
    return { ok: false };
  }

  if (!modelNamesRes.result.includes(modelName)) {
    const createResult = await createModelWithCardTypes(
      modelName,
      config?.noteType.fields ?? DEFAULT_WORD_NOTE_FIELDS.slice().map(String),
      config?.noteType.cardTypes ?? null,
      appendLog,
    );
    if (!createResult.ok) return createResult;
  } else {
    // Anki validates field references while adding a Card Type. Add all missing
    // configured fields first; Step 4 still owns exact removal and ordering.
    const fieldsResult = await addFieldsRequiredByCardTypes(
      modelName,
      config?.noteType.fields ?? DEFAULT_WORD_NOTE_FIELDS.slice().map(String),
      appendLog,
    );
    if (!fieldsResult.ok) return fieldsResult;

    const templatesRes = await cardTypeOperations.modelTemplates({ modelName });
    if (!templatesRes.ok || !templatesRes.result) {
      appendLog(`✗ modelTemplates failed: ${templatesRes.ok ? "null result" : templatesRes.error}`);
      return { ok: false };
    }

    const existingTemplates = templatesRes.result;
    const existingNames = new Set(Object.keys(existingTemplates));
    let missingNames = desiredNames.filter((name) => !existingNames.has(name));
    let extraNames = Object.keys(existingTemplates).filter((name) => !desiredNames.includes(name));
    appendLog(`Anki currently has ${existingNames.size} Card Types; missing=${missingNames.length}, extra=${extraNames.length}.`);
    const renames = missingNames.flatMap((newName) => {
      const desired = desiredTemplates[newName];
      const oldName = extraNames.find((candidate) => {
        const existing = existingTemplates[candidate];
        return existing?.Front.trim() === desired.Front.trim() && existing?.Back.trim() === desired.Back.trim();
      });
      return oldName ? [{ oldName, newName }] : [];
    });
    if (renames.length) {
      const renameResult = await renameCardTypes(modelName, renames, appendLog);
      if (!renameResult.ok) return renameResult;
      const renamedOldNames = new Set(renames.map((rename) => rename.oldName));
      const renamedNewNames = new Set(renames.map((rename) => rename.newName));
      missingNames = missingNames.filter((name) => !renamedNewNames.has(name));
      extraNames = extraNames.filter((name) => !renamedOldNames.has(name));
    }
    const existingFrontOwners = new Map(
      Object.entries(existingTemplates).map(([name, template]) => [template.Front.trim(), name]),
    );
    const frontConflicts = missingNames.flatMap((name) => {
      const owner = existingFrontOwners.get(desiredTemplates[name].Front.trim());
      return owner ? [`${name} با ${owner}`] : [];
    });
    if (frontConflicts.length) {
      appendLog(`✗ Card Type جدید به‌دلیل Front تکراری اضافه نشد: ${frontConflicts.join("، ")}.`);
      appendLog("Front این Card Type را تغییر دهید یا Card Type تکراری را از تنظیمات اپ حذف کنید، سپس دوباره Step 3 را اجرا کنید.");
      return { ok: false };
    }
    if (missingNames.length === 0) appendLog("✓ All required Card Types already exist.");
    else {
      appendLog(`Missing Card Types (${missingNames.length}): ${missingNames.join(", ")}`);
      const addResult = await addMissingCardTypes(modelName, missingNames, desiredTemplates, appendLog);
      if (!addResult.ok) return addResult;
    }
    if (extraNames.length) {
      appendLog(`Extra Card Types (${extraNames.length}): ${extraNames.join(", ")}`);
      const removeResult = await removeExtraCardTypes(modelName, extraNames, appendLog);
      if (!removeResult.ok) return removeResult;
    }
  }

  const confirmResult = await confirmAllCardTypesExist(modelName, desiredNames, appendLog);
  if (!confirmResult.ok) return { ok: false };

  appendLog("Step 3: Done.");
  return { ok: true };
}
