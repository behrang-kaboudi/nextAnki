# Whole-database `meaning_fa` context-leakage audit

Scan every current WordSense without changing the database. Identify candidate records where part of the Persian primary meaning may have been contributed by another word or phrase in a connected English sentence rather than by the WordSense `base_form` itself.

Apply the three approved checks: a different-sentence validity test, semantic-component attribution across the whole sentence regardless of distance, and a reverse-translation equivalence test. Treat automated matches only as candidates until semantically reviewed.
