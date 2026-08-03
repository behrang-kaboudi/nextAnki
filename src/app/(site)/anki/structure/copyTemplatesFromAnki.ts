import { ankiOperations, AnkiNoteTypes } from "@/lib/anki";

import type { LogFn, StepResult } from "./types";

type ExportResponse = {
  ok: boolean;
  error?: string;
  path?: string;
  templateNames?: string[];
};

export async function copyTemplatesFromAnki(appendLog: LogFn): Promise<StepResult> {
  appendLog(`Copying templates from Anki note type (${AnkiNoteTypes.META_LEX_VR9}) ...`);

  const templatesRes = await ankiOperations.modelTemplates({ modelName: AnkiNoteTypes.META_LEX_VR9 });
  if (!templatesRes.ok || !templatesRes.result) {
    appendLog(`✗ modelTemplates failed: ${templatesRes.ok ? "null result" : templatesRes.error}`);
    return { ok: false };
  }

  let response: Response;
  let result: ExportResponse;
  try {
    response = await fetch("/api/anki/templates/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates: templatesRes.result }),
    });
    result = (await response.json()) as ExportResponse;
  } catch (error) {
    appendLog(`✗ Could not save templates: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false };
  }

  if (!response.ok || !result.ok) {
    appendLog(`✗ Could not save templates: ${result.error ?? `HTTP ${response.status}`}`);
    return { ok: false };
  }

  appendLog(`✓ Copied ${result.templateNames?.length ?? 0} templates to ${result.path}.`);
  return { ok: true };
}
