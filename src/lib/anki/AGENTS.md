# Anki integration

- Keep every AnkiConnect transport, operation, and composed Anki workflow in this directory.
- Code outside this directory may call exported named operations/workflows, but must not call `request`, `requestDetailed`, `ankiRequest`, or the AnkiConnect HTTP endpoint directly.
- Export browser-safe shared operations from `index.ts`. Keep server-only workflows on explicit subpaths so client bundles do not pull in Prisma or Node-only modules.
- Prefer named operations from `operations/` over exposing raw AnkiConnect action strings.
