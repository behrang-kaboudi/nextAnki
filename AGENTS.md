# nextAnki — Agent Instructions (Root)

## General
- Keep changes minimal and scoped to the request.
- Prefer TypeScript + Prisma Client over raw SQL.
- When touching DB behavior, consider both `schema.prisma` and any code paths that write to the DB.
- Reuse-first: before creating a new component/helper, search the project for an existing equivalent and prefer using it.
- If unsure which existing component/helper to use (or whether one exists), ask the user before implementing.
- For any model table or model editor page, follow `src/docs/model-page-ui-standard.md`. Reuse the established page layout, button categories, hover/active behavior, and per-record controls before creating a variant.
- When adding a new internal/dev page, place it under `/tests` and add it to the most relevant Tests group in `src/config/siteMap.ts`; the central Tests hub is generated from that map.
- Keep the human-readable route inventory in `src/config/siteMap.ts` synchronized whenever any UI page is added, moved, renamed, or removed. Write or update its plain-English summary, and update `config/menus.json` when the page should be directly navigable. Test pages must live under `/tests`; the Tests hub reads its categories from this site map.

## Where To Look
- Prisma + migrations + `schema.prisma`: `prisma/AGENTS.md`
- `Word` write rules (including `updatedAt`): `src/lib/words/AGENTS.md`
- API route conventions: `src/app/api/AGENTS.md`

## Hard Rules (Project-wide)
- No raw SQL for `Word` writes in app code; use `src/lib/words/wordRepo.ts`.

## Backup + Push Workflow
- If asked to back up the local DB and push to GitHub, follow `backUpAndGetBackPrompt.txt` exactly (fresh backup → overwrite `dbBackupToWork/database_backup.archive` → commit all changes including backup → push). Do not compare/merge databases and do not add explanations.
