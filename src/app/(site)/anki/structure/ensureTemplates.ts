import { createAnkiOperations } from "@/lib/anki";
import { AnkiNoteTypes, WordAnkiConstants } from "@/lib/anki";
import type { AnkiStructureConfig } from "@/lib/anki/structureSettings";

import type { LogFn, StepResult } from "./types";

const templateOperations = createAnkiOperations({ timeoutMs: 200_000 });

function findTemplateUpdates(
  existing: Record<string, { Front: string; Back: string }>,
  desired: Record<string, { Front: string; Back: string }>,
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
  const updateRes = await templateOperations.updateModelTemplates({
    model: { name: modelName, templates: updates },
  });
  if (!updateRes.ok) {
    appendLog(`✗ updateModelTemplates failed: ${updateRes.error}`);
    return { ok: false };
  }
  return { ok: true };
}

export async function ensureMetaLexVr9Templates(
  appendLog: LogFn,
  config?: AnkiStructureConfig,
): Promise<StepResult> {
  const modelName = config?.noteType.name ?? AnkiNoteTypes.META_LEX_VR9;
  appendLog(`Step 5: Ensure Template content (${modelName})...`);

  const desired: Record<string, { Front: string; Back: string }> = config
    ? Object.fromEntries(
        config.noteType.cardTypes.map((template) => [
          template.name,
          { Front: template.front, Back: template.back },
        ]),
      )
    : WordAnkiConstants.noteTemplates;
  const desiredNames = Object.keys(desired) as Array<keyof typeof desired>;

  const templatesRes = await templateOperations.modelTemplates({ modelName });
  if (!templatesRes.ok || !templatesRes.result) {
    appendLog(`✗ modelTemplates failed: ${templatesRes.ok ? "null result" : templatesRes.error}`);
    return { ok: false };
  }

  const existing = templatesRes.result;
  const existingNames = new Set(Object.keys(existing));
  const missing = desiredNames.map(String).filter((name) => !existingNames.has(name));

  if (missing.length > 0) {
    appendLog(`✗ Missing Card Types: ${missing.join(", ")}`);
    appendLog("Run Step 3: Ensure Card Types. This Step only updates existing Front/Back content.");
    return { ok: false };
  }

  const updates = findTemplateUpdates(existing, desired);
  const updateResult = await updateChangedTemplates(modelName, updates, appendLog);
  if (!updateResult.ok) return updateResult;

  if (!Object.keys(updates).length) appendLog("✓ Template content already up-to-date.");
  else appendLog("✓ Template content updated.");
  appendLog("Step 5: Done.");
  return { ok: true };
}
