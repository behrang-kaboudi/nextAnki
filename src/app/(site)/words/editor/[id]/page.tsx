import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getWordEditorInitial } from "@/lib/words/editorPayload";

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

  const word = await getWordEditorInitial(id);
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
          initial={word}
        />
      </div>
    </main>
  );
}
