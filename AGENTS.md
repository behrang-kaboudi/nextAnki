# nextAnki — Agent Instructions (Root)

## General
- Keep changes minimal and scoped to the request.
- When the user explicitly asks Codex to inspect or operate an already-open browser page, use only that browser and that existing tab. If the requested browser or tab is unavailable to browser tooling, stop and explain the limitation, then propose available alternatives without using any of them until the user explicitly chooses or authorizes one.
- Prefer TypeScript + Prisma Client over raw SQL.
- When touching DB behavior, consider both `schema.prisma` and any code paths that write to the DB.
- Reuse-first is mandatory for every change: before implementing behavior or UI, search the project for the same or closest existing flow, component, helper, page, API route, and interaction pattern. Extend or compose the established implementation instead of creating a parallel variant.
- For UI work, inspect sibling pages and the live existing UI when available. Match established layout, spacing, typography, button taxonomy, states, sorting/filtering/paging behavior, validation, confirmations, notices, and responsive behavior unless the request explicitly requires a difference.
- When adding a field or capability to an existing table/editor, audit the whole established interaction contract for that field type (for example display, sorting, filtering, play/replace/record/delete controls for owned audio, loading/error states, and refresh behavior), rather than adding only a raw value.
- If no close precedent exists, or multiple precedents conflict and the choice would materially change behavior, ask the user before inventing a new pattern.
- For any model table or model editor page, follow `src/docs/model-page-ui-standard.md`. Reuse the established page layout, button categories, hover/active behavior, and per-record controls before creating a variant.
- When adding a new internal/dev page, place it under `/tests` and add it to the most relevant Tests group in `src/config/siteMap.ts`; the central Tests hub is generated from that map.
- Keep the human-readable route inventory in `src/config/siteMap.ts` synchronized whenever any UI page is added, moved, renamed, or removed. Write or update its plain-English summary, and update `config/menus.json` when the page should be directly navigable. Test pages must live under `/tests`; the Tests hub reads its categories from this site map.
- Wrap every rendered Persian UI string in an element with `dir="rtl"`. Mixed-language UI copy whose base language is Persian must also use `dir="rtl"`; use right alignment where the text is displayed as a block.

## Provider and spending boundary
- Agents, ChatGPT, and Codex must never directly call a separately billed provider API, use provider credentials, or operate provider SDKs on the user's behalf unless the user gives explicit, current, task-specific authorization for that direct provider call.
- The application owns its internal APIs and provider configuration. When the user explicitly authorizes a specific application operation, the agent may call the application's own API even when that endpoint internally uses the provider configured by the user. The agent must not read, select, replace, expose, or directly operate that provider or its credentials.
- Calling an authorized application API is an application action, not permission for the agent to make an equivalent direct provider call. Keep authorization scoped to the named application operation.
- Treat application APIs as provider-opaque capability boundaries. Agent-facing status, prompts, and workflow decisions should expose only the operation, inputs, remaining work, job state, and result; they must not require or reveal provider identity, credentials, billing configuration, or backend implementation details. Agents must not inspect behind an application API or branch workflow behavior based on the hidden provider.
- Do not ask whether an application endpoint is paid or free, infer its cost model, or require provider- or billing-specific approval. Authorization is scoped only to the user-visible application operation; any provider choice, billing arrangement, and execution cost behind that endpoint remain the application's private implementation detail.

## Page workflow routing

- When the user refers to "this page" or uses an equivalent contextual phrase such as "do the work for this page," resolve the page from the most recently identified application URL, route, or explicit page reference in the current conversation. Do not require the user to remember a workflow name or special trigger phrase.
- When that resolved page is `/words/tables/words`, read `src/app/(site)/words/tables/words/AGENTS.md` and `src/app/(site)/words/tables/words/page-workflow.md` completely, then follow that page workflow. A direct instruction to perform or continue the work for that page authorizes starting or continuing the documented workflow within its stated confirmation boundaries.
- If no page can be identified from the available conversation or application context, ask which page the user means instead of guessing.

## Prompt Response Artifacts
- Never create prompt inputs, model responses, JSON answers, reviewed IDs, QA reports, manifests, or related intermediate artifacts in the project root.
- Store every prompt run under `prompt-responses/<workflow-slug>/<YYYY-MM-DD>-<run-slug>/`; keep that run's prompt, response, corrections, reviewed-ID files, and QA evidence together in the same run folder.
- For parallel or batched work, create a stable subfolder per lane or batch (for example `lane-01/` or `batch-001/`) and keep its prompt, raw response, corrected response, and QA result together there.
- Use clear deterministic filenames such as `prompt.md`, `response.json`, `corrected-response.json`, `reviewed-ids.json`, `qa.md`, and `manifest.json`; do not create new root-level names such as `promptAns*.json`, `promptQ.json`, or `response*.json`.
- Do not move or delete existing prompt artifacts unless the user explicitly authorizes that cleanup; this rule governs all newly created artifacts.

## Word Sense Intake Workflow

- The global language convention for every project prompt is [American English Policy](src/prompts/_core/american-english-policy-v1.md) at `src/prompts/_core/american-english-policy-v1.md`. Every new or modified English value produced for storage must use contemporary standard American English. Do not create a conflicting regional-English rule in an individual prompt.
- The model-facing entry prompt is [Word Sense Intake System Instruction](src/prompts/word-extraction/word-sense-workflow/system-v1.md) at `src/prompts/word-extraction/word-sense-workflow/system-v1.md`.
- The canonical step-by-step guide is [Word Sense Intake Workflow Guide](src/prompts/word-extraction/word-sense-workflow/guide-v1.md) at `src/prompts/word-extraction/word-sense-workflow/guide-v1.md`.
- For any AI or agent task that receives an English word or phrase and asks for its meaning in a supplied sentence or context, read and follow the canonical guide. Execute only phases explicitly marked **ENABLED** and stop after the last enabled phase.
- When the user says they do not want to study a word or phrase, interpret that statement only as declining enrollment in the personal study list. Do not treat it as declining database insertion; database insertion is a separate decision that still requires its own explicit authorization, and the user will state explicitly when they do not want the candidate stored in the database.
- When composing another prompt through `src/prompts/_core/promptStore.ts`, include the guide with `{{> word-extraction/word-sense-workflow/guide-v1}}` instead of copying its contents.

## Site To-Do List

- The project's non-code future-work list is `project-planning/site-todo.md`.
- When the user says to add something to the "to-do list", append a new item to the end of that file; do not treat the request as authorization to implement it.
- When the user asks for a to-do report, read the whole file and report the pending work, useful implementation considerations, dependencies or risks, and practical recommendations. Keep recorded tasks distinct from agent recommendations.

## Where To Look
- Prisma + migrations + `schema.prisma`: `prisma/AGENTS.md`
- `WordSense` write rules (including `updatedAt`): `src/lib/words/AGENTS.md`
- API route conventions: `src/app/api/AGENTS.md`

## Hard Rules (Project-wide)
- No raw SQL for `WordSense` writes in app code; use `src/lib/words/wordSenseRepo.ts`.

### Strict preservation and no unrequested changes
- Make only the exact changes explicitly requested by the user.
- Never delete, remove, hide, replace, rename, relocate, disable, simplify, or deprecate any existing item unless the user explicitly requests that exact action.
- This prohibition applies to UI elements, buttons, icons, help indicators, tooltips, labels, text, notices, modals, behavior, interactions, validation, confirmations, application states, code, components, functions, variables, imports, comments, routes, APIs, tests, styles, configuration, documentation, files, database behavior, data, records, fields, assets, audio, images, backups, and generated files.
- Never remove something merely because it appears redundant, unused, superseded, duplicated, unnecessary after a new implementation, cleaner to replace, better handled elsewhere, or available inside another modal, component, or workflow.
- Adding a new feature does not authorize replacing or removing an existing feature. Add new functionality while preserving all existing functionality and UI unless the user explicitly requests a replacement.
- Do not perform unsolicited cleanup, refactoring, reorganization, modernization, renaming, formatting, deduplication, consolidation, or design improvement.
- Do not make temporary deletions or removals. Temporary removal is still prohibited.
- Do not infer permission to remove something from the general intent of a request. Permission must be explicit and specific to the exact item being removed or changed.
- If completing a request appears to require removing, replacing, hiding, renaming, moving, or disabling an existing item, stop before making that change, identify the exact item and reason, and ask the user for explicit permission.
- If a requested addition conflicts with existing behavior, preserve the existing behavior and ask the user how to resolve the conflict. Do not choose a resolution independently.
- Before finishing every task, inspect the complete diff and verify that no existing UI or behavior was lost, no unrelated code or file changed, no unsolicited cleanup occurred, and every modification maps directly to an explicit user request.
- If an unrequested removal or unrelated change was made accidentally, restore it before reporting completion.
- When uncertain whether a change is authorized, treat it as unauthorized and ask the user first.
- Core principle: preserve everything by default. Change only what the user explicitly requested. Addition is not permission for removal.

## Development Server Workflow
- The agent is responsible for all development-server commands. Do not ask the user to stop, start, restart, or recover the server after agent work.
- For tasks that do not require code changes, never pause, stop, restart, or otherwise interrupt any development server, application, background job, or shared service. Use only non-disruptive read-only inspection; if the inspection cannot continue without disruption, report the blocker and ask the user instead of interrupting anything.
- Agents must use `dev:start`, `dev:stop`, and `dev:restart`; reserve `npm run dev` for the user's foreground terminal. It automatically takes over any managed background server and runs on the same configured port.
- For every code-changing task, run `npm run dev:status` before the first file write.
- Keep the development server running for small, low-risk changes comparable to a simple save, such as a few localized lines in one file, copy/documentation edits, or an isolated style adjustment that needs only one quick check.
- Use the stop/start workflow for substantial changes: multi-file or shared-behavior edits, schema/dependency/configuration changes, work expected to require repeated saves or several test cycles, or any task whose scope grows beyond a small localized change.
- If a task initially appears small but grows while working, stop the server before continuing with the larger edit and test cycle.
- When the stop/start workflow applies and this workspace's development server is running, stop it gracefully with `npm run dev:stop`. The command must refuse to stop while an in-memory batch/background job is running or when job status cannot be verified.
- Batch the substantial file changes, then run TypeScript, ESLint, and other non-browser checks while the server is stopped.
- After using the stop/start workflow, the agent must start the server with `npm run dev:start`, wait for its ready confirmation, verify the affected page once, and leave it running on the same configured port (normally `3000`).
- Never stop a process by a broad name or port alone. The PID, workspace directory, and Next.js process identity must all be verified first.
- `npm run dev:stop -- --force` may bypass only the active-job check after the jobs have been checked manually; it must never bypass process ownership verification.

## Backup + Push Workflow
- If asked to back up the local DB and push to GitHub, follow `backUpAndGetBackPrompt.txt` exactly (fresh backup → overwrite `dbBackupToWork/database_backup.archive` → commit all changes including backup → push). Do not compare/merge databases and do not add explanations.
