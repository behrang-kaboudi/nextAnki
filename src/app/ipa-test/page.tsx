import IpaTestWordsTable from "./wordsTable";

export default async function IpaTestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const take = typeof sp.take === "string" ? Number.parseInt(sp.take, 10) : 100;

  return (
    <main style={{ padding: 24, maxWidth: 1400 }}>
      <h1>IPA Test (Words)</h1>
      <p style={{ marginTop: 8, color: "#555" }}>
        Reads random `Word` rows and shows `getIpaSegmentsWithSpaces` output for `phonetic_us` and `meaning_fa_IPA`.
      </p>

      <IpaTestWordsTable initialTake={Number.isFinite(take) ? take : 100} />
    </main>
  );
}
