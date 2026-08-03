import { ankiOperations } from "@/lib/anki";
import { AnkiNoteTypes, WordAnkiConstants } from "@/lib/anki";
import type { AnkiStructureConfig } from "@/lib/anki/structureSettings";

import type { LogFn, StepResult } from "./types";

export async function ensureAnkiPermission(appendLog: LogFn): Promise<StepResult> {
  const permRes = await ankiOperations.requestPermission();
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

async function requireModelExists(
  modelName: string,
  appendLog: LogFn,
): Promise<StepResult> {
  const modelNamesRes = await ankiOperations.modelNames();
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

  appendLog(`✗ Note Type ${modelName} does not exist.`);
  appendLog("Run Step 3: Ensure Card Types first. This Step never creates Card Types.");
  return { ok: false };
}

async function loadCurrentFields(modelName: string, appendLog: LogFn) {
  const fieldNamesRes = await ankiOperations.modelFieldNames({
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
    const res = await ankiOperations.modelFieldRemove({
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
    const res = await ankiOperations.modelFieldAdd({
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
    const res = await ankiOperations.modelFieldReposition({
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
  config?: AnkiStructureConfig,
): Promise<StepResult> {
  const modelName = config?.noteType.name ?? AnkiNoteTypes.META_LEX_VR9;
  appendLog(
    `Step 4: Ensure note fields (${modelName})...`,
  );

  const permissionResult = await ensureAnkiPermission(appendLog);
  if (!permissionResult.ok) return permissionResult;

  const desiredFields = config?.noteType.fields ?? WordAnkiConstants.noteFields.slice().map(String);
  const desiredSet = new Set<string>(desiredFields);

  const modelResult = await requireModelExists(modelName, appendLog);
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

  appendLog("Step 4: Done.");
  return { ok: true };
}
