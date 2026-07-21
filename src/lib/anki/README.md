# Anki integration boundary

All communication with Anki and AnkiConnect belongs in this directory.

- `client/`: low-level typed AnkiConnect transport, queueing, retries, and response types.
- `operations/`: application-facing named operations and the raw proxy transport.
- `deck/`: reusable deck, query, note, and review workflows.
- root workflow files: domain-specific synchronization jobs used by API routes.
- `scripts/`: standalone maintenance scripts that communicate with Anki.

Code outside this directory must import from `@/lib/anki` (or a workflow module
under it) and must not call the AnkiConnect endpoint or dispatch raw actions
directly.
