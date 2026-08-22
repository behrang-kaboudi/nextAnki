# WordSense table agent workflow

When the user asks the agent to perform, continue, or prepare the work for this page—including contextual wording such as "do the work for this page"—read and follow `page-workflow.md` completely before taking action. The user does not need to name this workflow or repeat the route when `/words/tables/words` is already the resolved page context.

Interpret requests to "complete the work for this page" or "complete the incomplete words through the API" as instructions to execute the remaining-data workflow through the application's existing APIs. Do not interpret those phrases as a request to implement, redesign, or modify API code. Treat API implementation as the user's intent only when the user explicitly asks for a code or API change.

Before preparing dependent work, establish the human-review policy with the user: `merge_only` means only `MERGE WORD CONCEPTS` pauses for human review, while `all_stages` means every dependent stage pauses. Under `merge_only`, continue across stages 1, 3, and 4 by applying each reviewed response through the application API and refreshing status after every Apply. Stop when stage 2 reaches human review, a genuine blocker occurs, or the dependent section is complete.

After all dependent stages are complete, follow the section-level execution policy in `page-workflow.md`: prompt-generated completion tasks may dispatch up to four non-empty `PromptAnswers` chats concurrently, Audio generation is launched and monitored through the provider-opaque application API after the user authorizes that application operation, and missing JSON hint runs last only after Audio reaches zero.
