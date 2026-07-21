import { ankiOperations } from "@/lib/anki";
import { AnkiNoteTypes, WordAnkiConstants } from "@/lib/anki";

import type { LogFn, StepResult } from "./types";

async function addMissingTemplates(
  modelName: string,
  missingNames: string[],
  desired: typeof WordAnkiConstants.noteTemplates,
  appendLog: LogFn,
): Promise<StepResult> {
  for (const name of missingNames) {
    appendLog(`Adding template: ${String(name)} ...`);
    const tpl = desired[name as keyof typeof desired];
    const res = await ankiOperations.modelTemplateAdd({
      modelName,
      template: { Name: String(name), Front: tpl.Front, Back: tpl.Back },
    });
    if (!res.ok) {
      appendLog(`✗ modelTemplateAdd failed: ${res.error}`);
      return { ok: false };
    }
  }
  return { ok: true };
}

function findTemplateUpdates(
  existing: Record<string, { Front: string; Back: string }>,
  desired: typeof WordAnkiConstants.noteTemplates,
) {
  const updates: Record<string, { Front: string; Back: string }> = {};
  for (const name of Object.keys(desired) as Array<keyof typeof desired>) {
    const tpl = desired[name];
    const curr = existing[String(name)] ?? null;
    if (!curr) continue;
    if (curr.Front !== tpl.Front || curr.Back !== tpl.Back) {
      updates[String(name)] = { Front: tpl.Front, Back: tpl.Back };
    }
  }
  return updates;
}

async function updateChangedTemplates(
  modelName: string,
  updates: Record<string, { Front: string; Back: string }>,
  appendLog: LogFn,
): Promise<StepResult> {
  const updateNames = Object.keys(updates);
  if (!updateNames.length) return { ok: true };

  appendLog(`Updating templates: ${updateNames.join(", ")} ...`);
  const updateRes = await ankiOperations.updateModelTemplates({
    model: { name: modelName, templates: updates },
  });
  if (!updateRes.ok) {
    appendLog(`✗ updateModelTemplates failed: ${updateRes.error}`);
    return { ok: false };
  }
  return { ok: true };
}

export async function ensureMetaLexVr9Templates(appendLog: LogFn): Promise<StepResult> {
  appendLog(`Step 4: Ensure note type templates (${AnkiNoteTypes.META_LEX_VR9})...`);

  const modelName = AnkiNoteTypes.META_LEX_VR9;
  const desired = WordAnkiConstants.noteTemplates;
  const desiredNames = Object.keys(desired) as Array<keyof typeof desired>;

  const templatesRes = await ankiOperations.modelTemplates({ modelName });
  if (!templatesRes.ok || !templatesRes.result) {
    appendLog(`✗ modelTemplates failed: ${templatesRes.ok ? "null result" : templatesRes.error}`);
    return { ok: false };
  }

  const existing = templatesRes.result;
  const existingNames = new Set(Object.keys(existing));
  const missing = desiredNames.map(String).filter((name) => !existingNames.has(name));

  const addResult = await addMissingTemplates(modelName, missing, desired, appendLog);
  if (!addResult.ok) return addResult;

  const updates = findTemplateUpdates(existing, desired);
  const updateResult = await updateChangedTemplates(modelName, updates, appendLog);
  if (!updateResult.ok) return updateResult;

  if (!missing.length && !Object.keys(updates).length) appendLog("✓ Templates already up-to-date.");
  else appendLog("✓ Templates ensured.");
  appendLog("Step 4: Done.");
  return { ok: true };
}
