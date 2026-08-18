# Migration QA

- Scope: 449 legacy external-vocabulary workflow files moved out of the project root.
- Preservation: original SHA-256 checksums matched immediately after the move; no files were deleted.
- Structure: 28 JSON files, 420 JSONL files, and 1 log file were moved with their original basenames.
- Parsing: all 28 moved JSON files and all 143,375 rows in the 420 moved JSONL files parsed successfully.
- References: stored cross-file references and 24 project source files were updated to the new run folder.
- Root cleanup: zero matching external-vocabulary, structurally-valid-vocabulary, or a1-source-catalog artifacts remain in the project root.
- Static verification: Node syntax checks, TypeScript, targeted ESLint, and `git diff --check` passed.
- Runtime verification: `/tests/words/external-sources` returned HTTP 200 from the restarted development server using the relocated catalog.
- Quality score: 10/10 — correctness, completeness, scope, consistency, clarity, preservation, and path integrity passed.
- Status: pass.
