/**
 * Backfills Word.phonetic_us_normalized and Word.meaning_fa_IPA_normalized
 * by calling the Next.js API endpoint that computes:
 * segmentsWithSpacesToDedupedString(getIpaSegmentsWithSpaces(...)).
 *
 * Requirements:
 * - dev server running (default: http://localhost:3000)
 */

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const batch = Number.parseInt(process.env.BATCH ?? "500", 10) || 500;

async function main() {
  let startId = Number.parseInt(process.env.START_ID ?? "0", 10) || 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  for (;;) {
    const url = new URL("/api/ipa-test/backfill-normalized", baseUrl);
    url.searchParams.set("batch", String(batch));
    url.searchParams.set("startId", String(startId));

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
      `processed=${totalProcessed} updated=${totalUpdated} nextStartId=${startId} done=${Boolean(json.done)}\n`
    );

    if (json.done) break;
  }

  process.stdout.write(`Done. processed=${totalProcessed} updated=${totalUpdated}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

