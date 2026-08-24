"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type GeneratedAudio = {
  url: string;
  written: string;
  ipa: string;
};

function lines(value: string) {
  return value.split(/\r?\n/u).map((line) => line.trim());
}

export function AzureIpaPlayground() {
  const [writtenInput, setWrittenInput] = useState("in\nfor\nma\ntion");
  const [ipaInput, setIpaInput] = useState("ɪn\nfɚ\nmeɪ\nʃən");
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<Record<number, GeneratedAudio>>({});
  const generatedRef = useRef(generated);
  generatedRef.current = generated;

  useEffect(
    () => () => {
      Object.values(generatedRef.current).forEach((item) =>
        URL.revokeObjectURL(item.url),
      );
    },
    [],
  );

  const writtenLines = useMemo(() => lines(writtenInput), [writtenInput]);
  const ipaLines = useMemo(() => lines(ipaInput), [ipaInput]);
  const rowCount = Math.max(writtenLines.length, ipaLines.length);
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    written: writtenLines[index] ?? "",
    ipa: ipaLines[index] ?? "",
  }));
  const lineCountsMatch = writtenLines.length === ipaLines.length;

  function clearGenerated() {
    Object.values(generatedRef.current).forEach((item) =>
      URL.revokeObjectURL(item.url),
    );
    setGenerated({});
    setError("");
  }

  async function generate(index: number, written: string, ipa: string) {
    setBusyIndex(index);
    setError("");
    try {
      const response = await fetch("/api/tests/tts/azure-ipa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ written, ipa }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(result?.error || `Azure request failed (${response.status}).`);
      }

      const url = URL.createObjectURL(await response.blob());
      setGenerated((current) => {
        const previous = current[index];
        if (previous) URL.revokeObjectURL(previous.url);
        return { ...current, [index]: { url, written, ipa } };
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Azure IPA Audio Test</h1>
          <p className="mt-1 max-w-3xl text-sm opacity-75">
            Paste matching written and IPA segments, one per line. Generate only
            the rows you want to send to the configured Azure English voice.
          </p>
        </div>
        <Link href="/tests" className="rounded border px-2.5 py-1.5 text-sm">
          Back to Less Used
        </Link>
      </div>

      <section className="mt-5 rounded-xl border bg-card p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Written segments
            <textarea
              value={writtenInput}
              onChange={(event) => {
                clearGenerated();
                setWrittenInput(event.target.value);
              }}
              rows={8}
              spellCheck={false}
              className="rounded-lg border bg-background p-3 font-mono text-sm font-normal"
              placeholder={"in\nfor\nma\ntion"}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            IPA segments
            <textarea
              value={ipaInput}
              onChange={(event) => {
                clearGenerated();
                setIpaInput(event.target.value);
              }}
              rows={8}
              spellCheck={false}
              className="rounded-lg border bg-background p-3 font-mono text-sm font-normal"
              placeholder={"ɪn\nfɚ\nmeɪ\nʃən"}
            />
          </label>
        </div>

        <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          Each Generate button makes one Azure synthesis request. Merely editing
          or previewing rows does not call Azure.
        </div>
        {!lineCountsMatch ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            Both columns must have the same number of lines.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide opacity-75">
          <div>Written</div>
          <div>IPA sent to Azure</div>
          <div>Audio</div>
        </div>
        {rows.map((row, index) => {
          const valid = Boolean(row.written && row.ipa && lineCountsMatch);
          const audio = generated[index];
          return (
            <div
              key={`${index}-${row.written}-${row.ipa}`}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-3 last:border-b-0"
            >
              <div className="break-words font-mono text-sm">
                {row.written || <span className="opacity-40">empty</span>}
              </div>
              <div className="break-words font-mono text-sm" dir="ltr">
                {row.ipa ? `/${row.ipa}/` : <span className="opacity-40">empty</span>}
              </div>
              <div className="flex min-w-48 items-center justify-end gap-2">
                {audio ? (
                  <audio controls preload="none" className="h-8 w-44" src={audio.url}>
                    <track kind="captions" />
                  </audio>
                ) : null}
                <button
                  type="button"
                  disabled={!valid || busyIndex !== null}
                  onClick={() => void generate(index, row.written, row.ipa)}
                  className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5"
                >
                  {busyIndex === index ? "Generating…" : "Generate"}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}
