import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

import WordEditorClient from "./word-editor.client";

export const runtime = "nodejs";

export default async function WordEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const word = await prisma.word.findUnique({
    where: { id },
    include: { sentenceRecord: true },
  });
  if (!word) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title={`Edit Word #${word.id}`}
          subtitle="Edit fields and save. Audio controls support generate/record/upload/delete for supported fields."
        />
        <Link
          href="/words/editor"
          className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        >
          Back to search
        </Link>
      </div>

      <div className="mt-4">
        <WordEditorClient
          initial={{
            id: word.id,
            anki_link_id: word.anki_link_id,
            base_form: word.base_form,
            phonetic_us: word.phonetic_us,
            phonetic_us_normalized: word.phonetic_us_normalized,
            meaning_fa: word.meaning_fa,
            meaning_fa_IPA: word.meaning_fa_IPA,
            meaning_fa_IPA_normalized: word.meaning_fa_IPA_normalized,
            pos: word.pos,
            concept_explained: word.concept_explained,
            concept_explained_fa: word.concept_explained_fa,
            word_hint_story: word.word_hint_story,
            sentenceRecordId: word.sentenceRecord?.id ?? null,
            sentence_en: word.sentenceRecord?.sentence_en ?? "",
            sentence_en_meaning_fa: word.sentenceRecord?.sentence_en_meaning_fa ?? null,
            explanation_for_sentence_meaning: word.explanation_for_sentence_meaning,
            learning_depth: word.learning_depth,
            mixed_sentence: word.mixed_sentence,
            other_meanings_fa: word.other_meanings_fa,
            category: word.category,
            typeOfWordInDb: word.typeOfWordInDb,
            hint_sentence: word.hint_sentence,
            first_letter_en_hint: word.first_letter_en_hint,
            first_letter_fa_hint: word.first_letter_fa_hint,
            hint_to_select: word.hint_to_select,
            json_hint: word.json_hint,
            word_note: word.word_note,
            common_error: word.common_error,
            imageability: word.imageability,
            createdAt: word.createdAt.toISOString(),
            updatedAt: word.updatedAt.toISOString(),
          }}
        />
      </div>
    </main>
  );
}
