# Prisma (Scoped to `prisma/`)

## Schema Changes
- Prefer additive schema changes; avoid breaking changes unless explicitly requested.
- Keep `WordSense.updatedAt` as `DateTime @updatedAt` (do not remove or change semantics).

## Migrations / Sync
- Prefer `prisma migrate` for tracked schema changes; use `db push` only when you intentionally want an untracked sync.
