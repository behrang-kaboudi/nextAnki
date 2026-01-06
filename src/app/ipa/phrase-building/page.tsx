import type { Metadata } from "next";
import { PictureWordType } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { Word2CharDemoClient } from "./Word2CharDemo.client";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Phrase Building",
};

export default async function PhraseBuildingPage() {
  const grouped = await prisma.pictureWord.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  const countByType = new Map<PictureWordType, number>(
    grouped.map((row) => [row.type, row._count._all]),
  );

  const types = Object.values(PictureWordType);

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Phrase Building"
        subtitle="For now, this page only displays the category types from the PictureWord model (PictureWordType)."
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-2">
          <h2 className="text-sm font-medium text-muted">PictureWordType</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((type) => (
              <li
                key={type}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <span className="font-mono">{type}</span>
                <span className="tabular-nums text-muted">
                  {countByType.get(type) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Word2CharDemoClient />
    </div>
  );
}
