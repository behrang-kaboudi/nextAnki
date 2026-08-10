# nextAnki — Agent Instructions (Root)

## General
- Keep changes minimal and scoped to the request.
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

## Where To Look
- Prisma + migrations + `schema.prisma`: `prisma/AGENTS.md`
- `Word` write rules (including `updatedAt`): `src/lib/words/AGENTS.md`
- API route conventions: `src/app/api/AGENTS.md`

## Hard Rules (Project-wide)
- No raw SQL for `Word` writes in app code; use `src/lib/words/wordRepo.ts`.

## Development Server Workflow
- The agent is responsible for all development-server commands. Do not ask the user to stop, start, restart, or recover the server after agent work.
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
