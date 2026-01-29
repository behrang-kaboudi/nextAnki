"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type LinkItem = { href: string; label: string; note?: string };
type Section = { title: string; links: LinkItem[]; defaultOpen?: boolean };

const sections: Section[] = [
  {
    title: "IPA",
    defaultOpen: true,
    links: [
      { href: "/ipa-test", label: "IPA Test" },
      { href: "/ipa/keywords", label: "IPA Keywords" },
      { href: "/ipa/picture-words", label: "Picture Words" },
      {
        href: "/ipa/picture-words/audio",
        label: "Picture Words Audio",
        note: "Record/upload/list audio",
      },
      { href: "/ipa/phrase-building", label: "Phrase Building" },
    ],
  },
  {
    title: "Word",
    defaultOpen: true,
    links: [
      { href: "/word-hints/json", label: "Word Hints — json_hint", note: "Preview & compare" },
      { href: "/word-hints/audio", label: "Word Hints — Audio", note: "Generate & manage" },
      { href: "/words/sentence-fields", label: "Sentence Fields", note: "TEMP: sentence_en + sentence_en_meaning_fa" },
      { href: "/word-extraction", label: "Word Extraction" },
      { href: "/words/word-cleanup", label: "Missing in DB" },
    ],
  },
  {
    title: "AI",
    links: [
      { href: "/ai/test", label: "AI Test" },
      { href: "/ai/prompt-builder", label: "Prompt Builder" },
    ],
  },
  {
    title: "Anki",
    links: [
      { href: "/anki-note", label: "Anki Note" },
      { href: "/anki-deck", label: "Anki Deck" },
    ],
  },
  {
    title: "Admin",
    links: [
      { href: "/admin/themes", label: "Themes" },
      { href: "/admin/data", label: "Data" },
      { href: "/admin/word/imageability", label: "Word Sentences" },
    ],
  },
  {
    title: "App",
    links: [
      { href: "/features", label: "Features" },
      { href: "/connect", label: "Connect" },
      { href: "/docs", label: "Docs" },
      { href: "/editor-test", label: "Editor Test" },
      { href: "/editor-demo", label: "Editor Demo" },
    ],
  },
  {
    title: "Other",
    links: [{ href: "/about", label: "About" }],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesQuery(item: LinkItem, sectionTitle: string, q: string) {
  if (!q) return true;
  const hay = normalize(`${sectionTitle} ${item.label} ${item.href} ${item.note ?? ""}`);
  return hay.includes(q);
}

function linkTitle(sectionTitle: string, item: LinkItem) {
  const parts = [
    item.label,
    item.note ? item.note : "",
    `${sectionTitle}: ${item.href}`,
  ].filter(Boolean);
  return parts.join(" — ");
}

export function TestsClient() {
  const [query, setQuery] = useState("");
  const q = normalize(query);

  const filteredSections = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        links: s.links.filter((l) => matchesQuery(l, s.title, q)),
      }))
      .filter((s) => s.links.length > 0);
  }, [q]);

  const totalLinks = useMemo(
    () => sections.reduce((sum, s) => sum + s.links.length, 0),
    []
  );
  const totalVisible = useMemo(
    () => filteredSections.reduce((sum, s) => sum + s.links.length, 0),
    [filteredSections]
  );

  return (
    <main className="mx-auto w-full max-w-6xl select-text p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tests</h1>
          <p className="mt-1 text-sm opacity-80">
            Central hub for internal dev/test pages.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[22rem]">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search links…"
              className="w-full rounded border px-3 py-2 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="text-xs opacity-70">
            Showing {totalVisible}/{totalLinks}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSections.map((section) => (
          <details
            key={section.title}
            className="rounded border bg-white/50 p-3 dark:bg-black/10"
            open={Boolean(!q && section.defaultOpen)}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              {section.title}{" "}
              <span className="text-xs font-normal opacity-60">
                ({section.links.length})
              </span>
            </summary>

            <div className="mt-3 grid gap-2">
              {section.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  title={linkTitle(section.title, l)}
                  className="group rounded border px-2.5 py-2 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-medium">
                      {l.label}
                    </div>
                    <div className="shrink-0 font-mono text-[10px] opacity-60 group-hover:opacity-90">
                      {l.href}
                    </div>
                  </div>
                  {l.note ? (
                    <div className="mt-1 text-xs opacity-70">{l.note}</div>
                  ) : null}
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
