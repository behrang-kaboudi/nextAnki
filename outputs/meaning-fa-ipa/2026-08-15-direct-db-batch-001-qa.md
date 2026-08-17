# Batch 001 QA — 100 records

- Scope: only PersianWord rows whose `meaning_fa_IPA` was null or empty at snapshot time.
- Standard: Standard Modern Persian (Tehrani); no enclosing slashes; no normalization generated.
- Schema: every item has exactly `id`, `canonical_text`, and `meaning_fa_IPA`; IDs are unique.
- Review: all 100 records were reviewed individually for consonants, short/long vowels, ezafe, compounds, and phrase boundaries.
- Corrections during review: standardized short Persian `a` to `æ`; retained `ɑː` only for long `â`; corrected ezafe after vowel-final words to `-je`; corrected `اجرایی` to include its hiatus glottal stop and restored the pronounced `r` in every `سرمایه` compound; kept the source spelling `مسیول` but transcribed its intended standard pronunciation `mæsʔuːl`.
- Item scores: IDs 60823, 60827, 60829–60830, and 60832–60927 each passed at 8.8/10 or higher.
- Batch score: 9.0/10.
- Status: PASS. No critical defect remains.
- Apply rule: update only when current database ID and `canonical_text` still match and `meaning_fa_IPA` is still null/empty; set only `meaning_fa_IPA` and `meaning_fa_IPA_confirmed=true`.
