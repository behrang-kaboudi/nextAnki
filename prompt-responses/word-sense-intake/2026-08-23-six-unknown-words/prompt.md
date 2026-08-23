# WordSense intake candidate generation

Generate one independently reviewed full-mode WordSense candidate for each target in `input.json`.

- Use the canonical workflow in `src/prompts/word-extraction/word-sense-workflow/guide-v1.md`.
- The local prompt-package API was called successfully for all twelve required fields.
- No contextual sentence was supplied, so select the most important general sense first, fix its part of speech and Persian meaning, and then generate a natural contemporary American English example sentence.
- Preserve the target order from `input.json`.
- Each candidate must contain exactly the twelve full-mode fields in the required order.
- Review every candidate independently and require a score of at least 8.0/10 with no critical defect.
- This run prepares reviewed JSON only. Do not insert a WordSense or change the personal study list without fresh user approval of the exact candidates.
