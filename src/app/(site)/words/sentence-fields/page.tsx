import { readFile } from "node:fs/promises";
import path from "node:path";

import { SentenceFieldsClient } from "./SentenceFieldsClient";

export const runtime = "nodejs";

async function readPrompt(relPath: string) {
  const absPath = path.join(process.cwd(), relPath);
  return readFile(absPath, "utf8");
}

export default async function SentenceFieldsTempPage() {
  const fullPrompt = await readPrompt("src/prompts/tempSent.md");

  return (
    <main className="mx-auto w-full max-w-5xl select-text p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Sentence Fields (TEMP)</h1>
        <p className="text-sm opacity-80">
          Temporary page to guide updating <span className="font-mono">sentence_en</span> and{" "}
          <span className="font-mono">sentence_en_meaning_fa</span>.
        </p>
      </div>

      <SentenceFieldsClient initialPrompt={fullPrompt} promptPath="src/prompts/tempSent.md" />
    </main>
  );
}
