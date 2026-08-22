# WordSense Table Agent Workflow

## Scope

This workflow coordinates agent-generated responses for the dependent stages on `/words/tables/words`. All writes go through the application's existing validated Apply APIs; the agent never edits the database directly. Before dependent work begins, the user chooses whether every dependent stage receives human review or only `MERGE WORD CONCEPTS` does.

In this page context, a request to complete the page's work, complete its incomplete words, or complete the work through the API means to run this workflow using the existing application APIs. It does not mean implementing or changing API code unless the user explicitly requests a code or API modification.

The complete agent workflow has three ordered sections. Human-only controls are not sections and never appear in workflow status.

### 1. Dependent agent workflow

1. `review_persian_meanings`
2. `merge_word_concepts`
3. `merge_inflected_forms`
4. `compare_word_meanings`

A later dependent stage is unavailable until every earlier dependent stage has zero remaining work. After each automatic Apply, the agent must re-read status and may continue to the next eligible dependent stage in the same user-requested page workflow. It stops at a required human-review gate, a genuine blocker, or the end of the section.

The supported human-review policies are:

- `merge_only`: `review_persian_meanings`, `merge_inflected_forms`, and `compare_word_meanings` are automatically applied after successful QA. `merge_word_concepts` always waits for human review.
- `all_stages`: every dependent stage waits for human review before Apply.

If the user has not already selected a policy for the current page-workflow request, ask once before the first Prepare call. Do not infer a policy from an earlier unrelated task.

### 2. Automated completion

After all four dependent stages are complete, finish this entire section in one agent run, in the returned task order:

1. `complete_learning_scores`
2. `generate_meaning_fa_ipa`
3. `review_persian_ipa`
4. `generate_phonetic_us`

The three prompt-generated task types `complete_learning_scores`, `generate_meaning_fa_ipa`, and `generate_phonetic_us` use parallel `PromptAnswers` dispatch:

- Split the complete remaining input snapshot into at most four stable, disjoint batches while preserving the original order and record identity.
- Create one separate user-visible task/chat in the `PromptAnswers` project for each non-empty batch, up to four tasks concurrently. Never create empty tasks merely to reach four.
- Give every task the authoritative prompt plus only its assigned records. Preserve deterministic batch labels such as `batch-01` through `batch-04`.
- Wait for every task, require per-item and per-batch QA scores of at least 8.0, and correct every failure before merge.
- Merge the responses back into the exact original input order, verify complete and unique ID coverage, and perform one independent whole-output QA pass before calling the task-specific Apply API.
- A slow or failed task follows the same cancel, duplicate-check, and bounded-retry rule used for task creation. Do not rerun successful sibling batches.

### 3. Generated assets and metadata

After automated completion is complete, finish this entire section in one agent run, in the returned task order:

1. `generate_audio`
2. `generate_json_hint`

For `generate_audio`, the agent owns launching the remaining audio jobs through the application's own API and waiting for every launched field job to finish before refreshing status. Start only when its returned `remaining` is greater than zero. Treat this API as provider-opaque: the agent sees only operation and job status, never inspects or receives provider identity, credentials, billing configuration, cost model, or backend implementation details, and never branches based on them. The agent must not ask whether the endpoint is paid or free or try to infer that fact. Once the user explicitly authorizes this specific site operation, call only the site API and do not request any provider-, billing-, or backend-specific confirmation.

Run `generate_json_hint` only after `generate_audio.remaining` reaches zero. Use only `mode=missing`, only when its returned `remaining` is greater than zero, and wait for that job to finish before refreshing status. Never run `mode=all` as agent work, and never bypass a blocked Audio step by starting JSON hint early.

`REVIEW MULTI-WORD ENTRIES`, `NEEDS YOUR ACTION`, and `Generate all json_hint` are separate human-only UI flows: exclude them completely from this workflow, its API counts, stage and section selection, dependency gating, pending artifacts, and response lifecycle.

## API contract

Use the application's configured localhost origin. The normal origin is `http://localhost:3009`.

1. Read initial status with `GET /api/v1/words-table-workflow/status`.
2. Read `sections`, `nextAgentSection`, and `nextAgentWork`. If `nextAgentWork` is `null`, report the returned states and stop.
3. Before dependent work, establish either `merge_only` or `all_stages`. For every later status refresh in that dependent run, use `GET /api/v1/words-table-workflow/status?humanReviewPolicy=<selected-policy>`.
4. When `nextAgentSection` is `dependent_agent_workflow`, prepare the one eligible stage with `POST /api/v1/words-table-workflow/prepare` and this body, then follow the prompt-response lifecycle below:

```json
{ "humanReviewPolicy": "merge_only" }
```

5. When `nextAgentSection` is `automated_completion` or `generated_assets_and_metadata`, process every task with `remaining > 0` in its returned order during the same agent run. Re-read status after each task and stop the section only when its `remaining` reaches zero or a genuine blocker occurs.
6. For a dependent stage, treat the returned `prompt` and `data` as authoritative. `data` contains every currently remaining eligible item for that stage; do not request a smaller batch and do not add records or fields from another source.
7. Create a user-visible task in the Codex project rooted at `/Users/seyedbehrangkaboudi/Personal-Local/Projects/PromtAnswers`. Give that task the complete prompt and data returned by the API. When the PromtAnswers coordinator asks how many tasks to use, choose and send a reasonable positive task count based on the returned item count and available concurrency; the user has delegated that operational choice to this coordinator. Then wait while the PromtAnswers task creates its child tasks when required, validates every item, and returns one final machine-consumable response plus QA evidence.
   - If the task-creation request remains pending for an unusually long time without returning a task id, cancel that pending request instead of waiting indefinitely.
   - Before retrying, list the current tasks in the `PromptAnswers` project and search for the intended title, input identity, or run identity. If a matching task exists, use it and do not create a duplicate.
   - Only when no matching task exists, send one fresh task-creation request with the same authoritative prompt and input snapshot.
   - If the fresh request also remains unresolved, repeat the duplicate check and report the task-creation blocker; never submit repeated blind retries.
8. Wait for that task to finish. Do not use background subagents as a substitute for the required user-visible PromtAnswers tasks.
9. Independently verify exact item coverage, identifiers, order, schema, task-specific semantics, and the minimum 8.0 quality score. Correct failures before submission.
10. Submit the reviewed dependent-stage response with `POST /api/v1/words-table-workflow/response`:

```json
{
  "runId": "the runId returned by prepare",
  "response": [],
  "qa": {
    "status": "passed",
    "score": 8.0,
    "criteria": {},
    "itemResults": [
      { "key": "one entry for every prepared item", "status": "passed", "score": 8.0 }
    ]
  }
}
```

`itemResults` must contain exactly one entry for every prepared top-level input item, and every item must have `status: "passed"` and `score >= 8.0`.

11. Follow the returned status exactly:
    - `awaiting_human_review`: report the prepared stage and item count, then stop for the existing UI review. This always occurs for `merge_word_concepts` and occurs for every dependent stage under `all_stages`.
    - `awaiting_automatic_apply`: call the returned `application.endpoint` with its returned HTTP method and body exactly as provided. Do not reconstruct, enrich, or edit the Apply payload. Require an `ok: true` response, then call `POST /api/v1/words-table-workflow/complete` with the `runId`.
12. After an automatic Apply is completed, refresh status with the selected policy. Continue from the newly returned `nextAgentWork`; never assume the next stage from the previous snapshot.
13. If an automatic application must be resumed after losing the original Response API result, retrieve the saved descriptor with `GET /api/v1/words-table-workflow/application?runId=<run-id>`. This endpoint is available only while that run is awaiting automatic Apply.

## Human review lifecycle

The response is stored under `prompt-responses/words-table-workflow/<run-id>/batch-001/` with `prompt.md`, `input.json`, `response.json`, `qa.json`, and `manifest.json`.

While an artifact is awaiting human review, the matching page button displays `AI response ready`. Clicking that button loads the saved response, rebuilds current source records through the existing stage API, and opens the existing human-review preview. The original manual `Create data` and paste workflow remains available when no saved response exists. Automatically applied artifacts do not appear as pending human-review responses.

Only the existing UI confirmation applies data. After a successful complete Apply, the artifact status changes to `applied`; files are preserved for recovery and audit. If current records no longer match the saved response, the existing stage validation must reject it. Do not bypass that validation or edit the database directly.

## Spending and safety

Do not use separately billed APIs, API keys, credits, or project scripts that call paid model services. Use only the current Codex/ChatGPT session and user-visible Codex tasks. Never submit a response whose per-item or overall QA score is below 8.0.
