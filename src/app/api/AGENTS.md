# API Routes (Scoped to `src/app/api/`)

## Conventions
- Keep handlers small and focused; push shared logic into `src/lib/`.
- Use `NextResponse.json` with `{ ok: boolean, ... }` shape for consistency.

## `WordSense` updates
- Any `WordSense` update must go through `src/lib/words/wordSenseRepo.ts` to ensure `updatedAt` refresh rules remain consistent.
