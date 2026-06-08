import { ankiRequestDetailed } from "@/lib/AnkiConnect";
import { AnkiNoteTypes, WordAnkiConstants } from "@/lib/AnkiDeck/constants";

import type { LogFn, StepResult } from "./types";

async function ensureAnkiPermission(appendLog: LogFn): Promise<StepResult> {
  const permRes = await ankiRequestDetailed("requestPermission");
  if (!permRes.ok) {
    appendLog(`✗ requestPermission failed: ${permRes.error}`);
    return { ok: false };
  }
  if (!permRes.result) {
    appendLog("✗ requestPermission returned null.");
    return { ok: false };
  }
  if (permRes.result.permission !== "granted") {
    appendLog("✗ Permission denied in AnkiConnect settings.");
    return { ok: false };
  }
  return { ok: true };
}

async function ensureModelExists(
  modelName: string,
  desiredFields: string[],
  appendLog: LogFn,
): Promise<StepResult> {
  const modelNamesRes = await ankiRequestDetailed("modelNames");
  if (!modelNamesRes.ok || !modelNamesRes.result) {
    appendLog(
      `✗ modelNames failed: ${modelNamesRes.ok ? "null result" : modelNamesRes.error}`,
    );
    return { ok: false };
  }

  if (modelNamesRes.result.includes(modelName)) {
    appendLog("✓ Model exists.");
    return { ok: true };
  }

  appendLog(`Creating model: ${modelName} ...`);
  const templates = WordAnkiConstants.noteTemplates;
  const cardTemplates = [
    {
      Name: "EnToFa",
      Front: templates.EnToFa.Front,
      Back: templates.EnToFa.Back,
    },
    {
      Name: "FaToEn",
      Front: templates.FaToEn.Front,
      Back: templates.FaToEn.Back,
    },
    { Name: "Emla", Front: templates.Emla.Front, Back: templates.Emla.Back },
    {
      Name: "Rahnama",
      Front: templates.Rahnama.Front,
      Back: templates.Rahnama.Back,
    },
    {
      Name: "Rahnama2",
      Front: templates.Rahnama2.Front,
      Back: templates.Rahnama2.Back,
    },
  ];
  const createRes = await ankiRequestDetailed("createModel", {
    modelName,
    inOrderFields: desiredFields,
    cardTemplates,
  });
  if (!createRes.ok) {
    appendLog(`✗ createModel failed: ${createRes.error}`);
    return { ok: false };
  }

  appendLog("✓ Model created.");
  return { ok: true };
}

async function loadCurrentFields(modelName: string, appendLog: LogFn) {
  const fieldNamesRes = await ankiRequestDetailed("modelFieldNames", {
    modelName,
  });
  if (!fieldNamesRes.ok || !fieldNamesRes.result) {
    appendLog(
      `✗ modelFieldNames failed: ${fieldNamesRes.ok ? "null result" : fieldNamesRes.error}`,
    );
    return { ok: false as const };
  }
  return { ok: true as const, fields: fieldNamesRes.result };
}

async function removeExtraFields(
  modelName: string,
  extraFields: string[],
  appendLog: LogFn,
): Promise<StepResult> {
  for (const fieldName of extraFields) {
    appendLog(`Removing field: ${fieldName} ...`);
    const res = await ankiRequestDetailed("modelFieldRemove", {
      modelName,
      fieldName,
    });
    if (!res.ok) {
      appendLog(`✗ modelFieldRemove failed: ${res.error}`);
      return { ok: false };
    }
  }
  return { ok: true };
}

async function addMissingFields(
  modelName: string,
  missingFields: string[],
  appendLog: LogFn,
): Promise<StepResult> {
  for (const fieldName of missingFields) {
    appendLog(`Adding field: ${fieldName} ...`);
    const res = await ankiRequestDetailed("modelFieldAdd", {
      modelName,
      fieldName,
    });
    if (!res.ok) {
      appendLog(`✗ modelFieldAdd failed: ${res.error}`);
      return { ok: false };
    }
  }
  return { ok: true };
}

async function repositionFields(
  modelName: string,
  desiredFields: string[],
  appendLog: LogFn,
): Promise<StepResult> {
  for (let i = 0; i < desiredFields.length; i += 1) {
    const fieldName = desiredFields[i];
    const res = await ankiRequestDetailed("modelFieldReposition", {
      modelName,
      fieldName,
      index: i,
    });
    if (!res.ok) {
      appendLog(`✗ modelFieldReposition failed for ${fieldName}: ${res.error}`);
      return { ok: false };
    }
  }
  return { ok: true };
}

export async function ensureMetaLexVr9NoteType(
  appendLog: LogFn,
): Promise<StepResult> {
  appendLog(
    `Step 3: Ensure note type (${AnkiNoteTypes.META_LEX_VR9}) + exact fields...`,
  );

  const permissionResult = await ensureAnkiPermission(appendLog);
  if (!permissionResult.ok) return permissionResult;

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  const desiredFields = WordAnkiConstants.noteFields.slice().map(String);
  const desiredSet = new Set<string>(desiredFields);

  const modelResult = await ensureModelExists(
    modelName,
    desiredFields,
    appendLog,
  );
  if (!modelResult.ok) return modelResult;

  const fieldsResult = await loadCurrentFields(modelName, appendLog);
  if (!fieldsResult.ok) return { ok: false };

  const currentFields = fieldsResult.fields;
  const extras = currentFields.filter(
    (fieldName) => !desiredSet.has(fieldName),
  );
  const missing = desiredFields.filter(
    (fieldName) => !currentFields.includes(fieldName),
  );

  const removeResult = await removeExtraFields(modelName, extras, appendLog);
  if (!removeResult.ok) return removeResult;

  const addResult = await addMissingFields(modelName, missing, appendLog);
  if (!addResult.ok) return addResult;

  const repositionResult = await repositionFields(
    modelName,
    desiredFields,
    appendLog,
  );
  if (!repositionResult.ok) return repositionResult;

  appendLog("Step 3: Done.");
  return { ok: true };
}
