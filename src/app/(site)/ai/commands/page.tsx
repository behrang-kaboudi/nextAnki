import { readFile } from "node:fs/promises";
import path from "node:path";

type CommandEntry = {
  title: string;
  paragraphs: string[];
};

type CommandSection = {
  title: string;
  entries: CommandEntry[];
};

function parseCommandsMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? "دستورهای AI";
  const firstSectionIndex = lines.findIndex((line) => line.startsWith("## "));
  const introduction = lines
    .slice(1, firstSectionIndex === -1 ? lines.length : firstSectionIndex)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  const sections: CommandSection[] = [];
  let currentSection: CommandSection | null = null;
  let currentEntry: CommandEntry | null = null;

  for (const rawLine of lines.slice(Math.max(firstSectionIndex, 0))) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("## ")) {
      currentSection = { title: line.slice(3).trim(), entries: [] };
      sections.push(currentSection);
      currentEntry = null;
      continue;
    }

    if (line.startsWith("### ") && currentSection) {
      currentEntry = { title: line.slice(4).trim(), paragraphs: [] };
      currentSection.entries.push(currentEntry);
      continue;
    }

    if (currentEntry) currentEntry.paragraphs.push(line);
  }

  return { title, introduction, sections };
}

export default async function AiCommandsPage() {
  const markdownPath = path.join(process.cwd(), "src", "docs", "ai-commands.md");
  const content = parseCommandsMarkdown(await readFile(markdownPath, "utf8"));

  return (
    <main dir="rtl" lang="fa" className="mx-auto w-full max-w-4xl p-4 text-right sm:p-6">
      <header className="border-b border-card pb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">AI</div>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{content.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">{content.introduction}</p>
      </header>

      <div className="mt-5 grid gap-6">
        {content.sections.map((section) => (
          <section key={section.title} aria-labelledby={`section-${section.title}`}>
            <h2 id={`section-${section.title}`} className="text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            <div className="mt-3 grid gap-3">
              {section.entries.map((entry) => (
                <article key={entry.title} className="rounded-lg border border-card bg-card p-4 shadow-elevated">
                  <h3 className="font-semibold text-foreground">{entry.title}</h3>
                  <div className="mt-2 grid gap-2 text-sm leading-7 text-muted">
                    {entry.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
