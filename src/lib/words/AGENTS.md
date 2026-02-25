# Words Library (Scoped to `src/lib/words/`)

## `Word` writes MUST refresh `updatedAt`
Any code that updates the `Word` model must ensure `updatedAt` is refreshed.

### Preferred (default): Prisma `@updatedAt`
- Keep `prisma/schema.prisma` field `Word.updatedAt` as `DateTime @updatedAt`.
- Use Prisma Client writes; Prisma handles `updatedAt` automatically for `@updatedAt`.
- Do not manually set `updatedAt` in `data` unless there is a specific reason.

### Required: use the repo helpers
- Use `updateWord()` / `updateManyWords()` from `src/lib/words/wordRepo.ts` for all `Word` updates in app code.
- Avoid direct `prisma.word.update` / `prisma.word.updateMany` calls outside `wordRepo.ts`.

### If you must use raw SQL (last resort)
- Any `UPDATE Word ...` via `$executeRaw` / raw queries must also update `updatedAt` (e.g. `updatedAt = NOW()`).

