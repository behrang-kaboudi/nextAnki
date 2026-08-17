import fs from "node:fs";

const [filePath, encodedScores] = process.argv.slice(2);

if (!filePath || !encodedScores) {
  throw new Error("Usage: node apply-new-productive-target-batch.mjs <file> <row:score,...>");
}

const scores = new Map(
  encodedScores.split(",").map((pair) => {
    const [rowText, scoreText] = pair.split(":");
    const row = Number(rowText);
    const score = Number(scoreText);
    if (!Number.isInteger(row) || !Number.isInteger(score) || score < 1 || score > 101) {
      throw new Error(`Invalid score pair: ${pair}`);
    }
    return [row, score];
  }),
);

if (scores.size !== encodedScores.split(",").length) {
  throw new Error("Duplicate source_row_index in score batch");
}

const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
let matched = 0;

for (const entry of document.entries) {
  const score = scores.get(entry.source_row_index);
  if (score === undefined) continue;
  entry.new_productive_target = score;
  matched += 1;
}

if (matched !== scores.size) {
  throw new Error(`Matched ${matched} entries for ${scores.size} supplied scores`);
}

document.stats = {
  ...document.stats,
  new_productive_target_completed: document.entries.filter(
    (entry) => Number.isInteger(entry.new_productive_target),
  ).length,
  new_productive_target_total: document.entries.length,
  new_productive_target_method: "GPT-5.6-sol semantic evaluation using productive_target prompt",
};

fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);

console.log(
  JSON.stringify({
    applied: matched,
    completed: document.stats.new_productive_target_completed,
    total: document.stats.new_productive_target_total,
  }),
);
