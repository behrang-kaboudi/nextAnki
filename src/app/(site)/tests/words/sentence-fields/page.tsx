import { renderPromptFromFile } from "@/prompts/_core/promptStore";
import { SentenceFieldsClient } from "./SentenceFieldsClient";

export const runtime = "nodejs";

export default async function SentenceFieldsTempPage() {
  const promptPaths = [
    "src/prompts/tempSent.md",
    "src/prompts/word-extraction/sentence_meaning_fa/rulseV1.md",
  ];
  const fullPrompt = await renderPromptFromFile({ file: "tempSent.md" });

  return (
    <main className="mx-auto w-full max-w-5xl select-text p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Sentence Fields (TEMP)</h1>
        <p className="text-sm opacity-80">
          Temporary page to guide updating <span className="font-mono">sentence_en</span> and{" "}
          <span className="font-mono">sentence_en_meaning_fa</span>.
        </p>
      </div>

      <SentenceFieldsClient initialPrompt={fullPrompt} promptPaths={promptPaths} />
    </main>
  );
}
