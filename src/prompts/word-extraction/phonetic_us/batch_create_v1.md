## Batch input and output

Input contains one object for every EnglishWord record:

```json
[{"id": 1, "base_form": "example"}]
```

Return only a JSON array containing every input `id` exactly once:

```json
[{"id": 1, "phonetic_us": "ɪɡzæmpəl"}]
```

Each `phonetic_us` value must contain IPA only.
