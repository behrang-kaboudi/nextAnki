# API Routes (Scoped to `src/app/api/`)

## Conventions
- Keep handlers small and focused; push shared logic into `src/lib/`.
- Use `NextResponse.json` with `{ ok: boolean, ... }` shape for consistency.

## `Word` updates
- Any `Word` update must go through `src/lib/words/wordRepo.ts` to ensure `updatedAt` refresh rules remain consistent.

