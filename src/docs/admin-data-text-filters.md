# Admin Data: Text Filters (`*` wildcard)

## Current behavior (implemented)
- In text filter values, `*` means “exactly one character” (SQL `LIKE` `_` wildcard).
- Applies to operators: `eq`, `neq`, `contains`, `notContains`, `startsWith`.
- Examples:
  - `eq` + `foo*bar` → matches `fooXbar` (one char between), not `fooXXbar`.
  - `contains` + `foo**bar` → matches `fooXYbar` (exactly two chars between).
  - `startsWith` + `ab*` → matches `abX...` (at least one more char).
- Special SQL wildcard chars `%` and `_` are escaped; `*` is the only wildcard supported.

## Next step (planned)
- Replace the `*`-wildcard behavior with a proper `RegExp`-based text search option.
- When that happens:
  - UI should expose a “Regex” mode (or a dedicated operator).
  - Server should translate regex to the DB engine’s regex feature (e.g. MySQL `REGEXP`) or do safe post-filtering where necessary.
