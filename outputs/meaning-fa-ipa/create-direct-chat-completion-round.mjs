import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const roundDirectory = resolve(process.argv[2] || "outputs/meaning-fa-ipa/2026-08-15-direct-chat-completion-round-002");
const batchSize = 300;
const prisma = new PrismaClient();

const basePrompt = await readFile(resolve("src/prompts/word-extraction/base/inputOutRulseV1 .md"), "utf8");
const ipaPrompt = await readFile(resolve("src/prompts/word-extraction/meaning_fa_IPA/rulseV1.md"), "utf8");
const qualityHeader = `HIGH-QUALITY PRODUCTION OUTPUT REQUIRED:

- This is production vocabulary data. Return the highest-quality Persian pronunciation output you can produce.
- Linguistic correctness for every individual record is more important than speed.
- Do not let a high batch average hide a weak item; silently correct every doubtful item before returning the JSON.`;
const executionContract = `

TASK CONTRACT

- Act only as a prompt-response engine for the data included below.
- Do not inspect files, repositories, databases, browser pages, tools, memory, or external sources.
- Do not modify anything and do not call any tool. The coordinating task will persist your response.
- Produce exactly one compact JSON array and nothing else: no Markdown fence, explanation, score report, heading, or trailing text.
- Return exactly one item per input item, in the identical order.
- Every output item must contain exactly two keys: {"id": <same integer>, "meaning_fa_IPA": "<non-empty IPA>"}.
- Never add slashes around IPA and never include Persian script in meaning_fa_IPA.
- Before emitting the final JSON, review every item individually for Persian pronunciation, short/long vowels, consonants, ezafe, conjunctions, clitics, compounds, word boundaries, loanwords, clarity, and schema compliance.
- Assign every item and the batch an internal quality score. Correct every item at or below 8.0/10 and re-review it. Do not expose scores in this response.
- Aim for the highest score you can reach; a passing batch average cannot hide an individual item at or below 8.0/10.
`;

try {
  const where = { OR: [{ meaning_fa_IPA: null }, { meaning_fa_IPA: "" }] };
  const [remainingBefore, rows] = await Promise.all([
    prisma.persianWord.count({ where }),
    prisma.persianWord.findMany({
      where,
      orderBy: { id: "asc" },
      select: { id: true, canonical_text: true },
    }),
  ]);
  if (rows.length !== remainingBefore) throw new Error(`Count/query mismatch: ${remainingBefore} vs ${rows.length}.`);
  if (rows.length === 0) throw new Error("No PersianWord rows are missing meaning_fa_IPA.");

  const laneCount = Math.ceil(rows.length / batchSize);
  const labelWidth = Math.max(2, String(laneCount).length);
  await mkdir(roundDirectory, { recursive: true });
  const manifest = {
    round: 2,
    createdAt: new Date().toISOString(),
    source: "Anki Prisma PersianWord rows with null/empty meaning_fa_IPA, ordered by id ascending",
    project: { name: "PromptAnswers", id: "8fb394cb-9f70-4afc-bf64-fe7a8771b8d7" },
    remainingBefore,
    laneCount,
    batchSize,
    totalRecords: rows.length,
    acceptance: { batchScore: "> 8.0", minimumItemScore: "> 8.0", maximumScoreQuestions: 4 },
    status: "inputs_prepared",
    lanes: [],
  };

  for (let lane = 1; lane <= laneCount; lane += 1) {
    const items = rows.slice((lane - 1) * batchSize, lane * batchSize);
    const laneLabel = String(lane).padStart(labelWidth, "0");
    const inputName = `lane-${laneLabel}-input.json`;
    const promptName = `lane-${laneLabel}-prompt.txt`;
    const inputText = `${JSON.stringify(items, null, 2)}\n`;
    const promptText = `${qualityHeader}\n\n${basePrompt.trim()}\n\n${ipaPrompt.trim()}\n${executionContract}\nINPUT DATA — BATCH ${lane}/${laneCount}\n\n${JSON.stringify(items)}\n`;
    await writeFile(resolve(roundDirectory, inputName), inputText, "utf8");
    await writeFile(resolve(roundDirectory, promptName), promptText, "utf8");
    manifest.lanes.push({
      lane,
      count: items.length,
      firstId: items[0].id,
      lastId: items.at(-1).id,
      inputFile: inputName,
      promptFile: promptName,
      inputSha256: createHash("sha256").update(inputText).digest("hex"),
      promptSha256: createHash("sha256").update(promptText).digest("hex"),
      status: "input_prepared",
    });
  }

  await writeFile(resolve(roundDirectory, "round-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ roundDirectory, remainingBefore, totalRecords: rows.length, laneCount, lastBatchSize: manifest.lanes.at(-1).count }, null, 2));
} finally {
  await prisma.$disconnect();
}
