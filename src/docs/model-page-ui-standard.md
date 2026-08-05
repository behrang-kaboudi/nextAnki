# Model page UI standard

Apply this standard when creating or changing a page that displays or edits a Prisma model, especially a table under `src/app/(site)/words/tables`.

The PersianWord table is the current reference implementation for table layout, audio controls, and batch jobs. Reuse its shared patterns and components before creating a new variant.

## Page layout

1. Start with `PageHeader` containing the model name and a short description of the record's purpose.
2. Put search, filters, paging settings, and the primary search action in one bordered control card.
3. Below the search form, use a separated two-column action area on large screens:
   - left: record-level or maintenance entry points, such as **Add** and non-batch tools;
   - right: the main batch job for the model.
4. Stack those two areas on small screens. Keep the same visual border and spacing as the PersianWord table.
5. Follow with the column selector, pagination summary, then the scrollable data table.

## Table behavior

- Support the existing table conventions: column selection, retained columns in URLs, sortable headings, paging, empty state, and a missing-audio filter where the model owns audio.
- Always show a stable primary key column. Use `TableColumnIndicators` for primary keys, unique values, and indexes.
- Keep the audio controls in the audio column and editing/deleting record controls in the actions column.
- Do not silently hide a database constraint: communicate unique/index behavior through a column indicator or helper text.

## Button taxonomy and interaction

- **Text buttons** are for page-level actions: Search, Clear, Add, Generate missing audio, and navigation.
- **Icon buttons** are for compact per-record actions. Use `ActionIcon`, never emoji or ad-hoc SVGs, and give every icon button both `aria-label` and `title`.
- Use the standard icon button treatment: `rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5`.
- Use the standard text button treatment: `rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5`.
- Disable a control while its request is running. Show a concise success notice or an inline, readable error next to the affected record.
- Ask for confirmation before destructive operations such as deleting a record or its audio file.
- Refresh the server-rendered table after a successful mutation so other columns remain accurate.

## Audio field standard

For any model with one owned audio file, mirror `PersianWordAudioControls`:

1. play/pause;
2. generate/replace with TTS;
3. record/stop from microphone and upload;
4. delete.

The audio API must validate the record id and upload, normalize saved output to MP3 when recording, store only a generated safe filename, update the model field, and remove the previous owned file only after the replacement is stored.

## Batch jobs

- Place the batch job in the right side of the control card.
- Use the same structure as `BatchPersianWordAudioGenerate`: a title, one-sentence scope, action button, progress counts, current item, and error.
- For missing audio, the scope must be explicit: only rows whose model-specific audio filename field is empty are processed. Use the actual model and field names in the sentence.
- Do not overwrite completed data in a "missing" job. Per-record generate actions may explicitly replace the existing file.
- Publish progress through `JOB_PROGRESS_TOPICS` and register the server status getter in `jobProgressCatalog`.

## Reuse checklist

Before adding a control, search for an equivalent under the model's sibling pages. For the Words tables, use these as references:

- layout and batch audio: `persian-words/page.tsx` and `BatchPersianWordAudioGenerate.client.tsx`;
- per-record audio interactions: `PersianWordAudioControls.client.tsx`;
- compact icon set: `src/components/icons/ActionIcon.tsx`.

If a new model needs a different behavior, keep the same visual interaction contract unless the difference is intentional and documented in the page itself.
