import Link from "next/link";

import { WORD_ANKI_FIELD_GENERATORS } from "@/lib/anki/wordAnkiMapping";

export const metadata = {
  title: "Test Functions",
};

export const runtime = "nodejs";

const SAMPLE_JSON_HINT = {
  person: {
    fa: "قناری",
    en: "canary",
    anki_link_id: "3405_1770146906585",
    target_ipa: "kenerɪ",
    usage: "noun",
    source: "word",
    target_lang: "en",
    imageability: 88,
  },
  job: {
    fa: "آمپول",
    phinglish: "ampul",
    en: "ampoule",
    target_ipa: "ʌmpʊl",
    usage: "person",
    source: "pictureWord",
  },
  persianImage: {
    fa: "تقویم",
    phinglish: "taghvim",
    en: "calendar",
    target_ipa: "tæɣvɪm",
    usage: "person",
    source: "pictureWord",
  },
  generatedAtMs: 1770621512780,
} as const;

const MOCK_WORD_FOR_JSON_HINT = {
  anki_link_id: "test-functions-mock",
  base_form: "",
  meaning_fa: "",
  imageability: 0,
  json_hint: JSON.stringify(SAMPLE_JSON_HINT),
} as unknown as Parameters<typeof WORD_ANKI_FIELD_GENERATORS.json_hint>[0];

export default async function TestFunctionsSamplePage() {
  const generatedFirstLetterFaHint =
    await WORD_ANKI_FIELD_GENERATORS.first_letter_fa_hint(
      MOCK_WORD_FOR_JSON_HINT,
    );
  const generatedFirstLetterEnHint =
    await WORD_ANKI_FIELD_GENERATORS.first_letter_en_hint(
      MOCK_WORD_FOR_JSON_HINT,
    );

  return (
    <main className="mx-auto w-full max-w-3xl select-text p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold">Test Functions</h1>
        <Link
          href="/tests"
          className="rounded border px-2.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Back to Tests
        </Link>
      </div>

      <p className="mt-3 text-sm opacity-80">
        Sample page for the <span className="font-medium">test functions</span>{" "}
        group.
      </p>

      <section className="mt-6 rounded border bg-white/50 p-3 dark:bg-black/10">
        <h2 className="text-sm font-semibold">I want to test</h2>
        <div className="mt-2 text-sm">
          <div className="font-mono text-xs opacity-80">
            first_letter_fa_hint: async (w)
          </div>

          <div className="mt-3 text-xs font-semibold opacity-70">
            json_hint input
          </div>
          <pre className="mt-1 overflow-auto rounded border bg-black/5 p-2 text-[12px] dark:bg-white/5">
            {JSON.stringify(SAMPLE_JSON_HINT, null, 2)}
          </pre>

          <div className="mt-3 text-xs font-semibold opacity-70">output</div>
          <pre className="mt-1 whitespace-pre-wrap rounded border bg-black/5 p-2 font-mono text-[12px] dark:bg-white/5">
            {generatedFirstLetterFaHint || "(empty)"}
          </pre>

          <div className="mt-6 font-mono text-xs opacity-80">
            first_letter_en_hint: async (w)
          </div>
          <div className="mt-3 text-xs font-semibold opacity-70">output</div>
          <pre className="mt-1 whitespace-pre-wrap rounded border bg-black/5 p-2 font-mono text-[12px] dark:bg-white/5">
            {generatedFirstLetterEnHint || "(empty)"}
          </pre>
        </div>
      </section>
    </main>
  );
}
