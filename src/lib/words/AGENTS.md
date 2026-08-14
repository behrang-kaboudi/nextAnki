# Words Library (Scoped to `src/lib/words/`)

## `WordSense` writes MUST refresh `updatedAt`
Any code that updates the `WordSense` model must ensure `updatedAt` is refreshed.

### Preferred (default): Prisma `@updatedAt`
- Keep `prisma/schema.prisma` field `WordSense.updatedAt` as `DateTime @updatedAt`.
- Use Prisma Client writes; Prisma handles `updatedAt` automatically for `@updatedAt`.
- Do not manually set `updatedAt` in `data` unless there is a specific reason.

### Required: use the repo helpers
- Use `updateWordSense()` / `updateManyWordSenses()` from `src/lib/words/wordSenseRepo.ts` for all `WordSense` updates in app code.
- Avoid direct `prisma.wordSense.update` / `prisma.wordSense.updateMany` calls outside `wordSenseRepo.ts`.

### If you must use raw SQL (last resort)
- Any `UPDATE word_sense ...` via `$executeRaw` / raw queries must also update `updatedAt` (e.g. `updatedAt = NOW()`).
