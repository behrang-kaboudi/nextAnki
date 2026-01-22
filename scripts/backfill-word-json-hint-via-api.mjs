/**
 * Backfills Word.json_hint by calling:
 * POST /api/ipa-test/backfill-word-json-hint
 *
 * Requirements:
 * - dev server running (default: http://localhost:3000)
 *
 * Env:
 * - BASE_URL=http://localhost:3000
 * - BATCH=200
 * - START_ID=0
 * - ONLY_EMPTY=true (default)
 * - DRY_RUN=true (default)
 */

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const batch = Number.parseInt(process.env.BATCH ?? "200", 10) || 200;
const onlyEmpty = (process.env.ONLY_EMPTY ?? "true").trim().toLowerCase() !== "false";
const dryRun = (process.env.DRY_RUN ?? "true").trim().toLowerCase() !== "false";

async function main() {
  let startId = Number.parseInt(process.env.START_ID ?? "0", 10) || 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  for (;;) {
    const url = new URL("/api/ipa-test/backfill-word-json-hint", baseUrl);
    url.searchParams.set("batch", String(batch));
    url.searchParams.set("startId", String(startId));
    url.searchParams.set("onlyEmpty", String(onlyEmpty));
    url.searchParams.set("dryRun", String(dryRun));

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Backfill failed: ${res.status} ${res.statusText}\n${text}`);
    }
    const json = await res.json();

    totalProcessed += json.processed ?? 0;
    totalUpdated += json.updated ?? 0;
    startId = json.nextStartId ?? startId;

    process.stdout.write(
      `processed=${totalProcessed} updated=${totalUpdated} nextStartId=${startId} done=${Boolean(json.done)} onlyEmpty=${onlyEmpty} dryRun=${dryRun}\n`
    );

    if (json.done) break;
  }

  process.stdout.write(`Done. processed=${totalProcessed} updated=${totalUpdated}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

