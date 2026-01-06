# Word extraction prompts

Place your prompt files for word extraction in this folder.

Recommended formats:
- `*.md` (Markdown)
- `*.txt` (plain text)

These files are intended to be read on the server (API route / server action) and shown in the UI via buttons.

Structure used in this repo:
- `partials/`: reusable rules / schemas / samples
- `templates/`: final prompts composed via `{{> include}}` + `{{vars}}`
