import { PageHeader } from "@/components/page-header";

const features = [
  {
    title: "Deck management",
    description: "List decks, create new decks, and show basic stats.",
  },
  {
    title: "Card creation",
    description:
      "Create cards with templates, custom fields, and fast tagging.",
  },
  {
    title: "Search & filters",
    description: "Search notes/cards and filter by tag or deck.",
  },
  {
    title: "Controlled sync",
    description: "Batch operations with a clear preview of changes.",
  },
  {
    title: "Safety & permissions",
    description: "Clear connection state and request-scoped permissions.",
  },
  {
    title: "Workflows",
    description: "Daily reviews, study planning, and suggested flows.",
  },
];

export default function FeaturesPage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Features"
        subtitle="This is the UX target; the real AnkiConnect integration will be added later."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-card bg-card p-5 shadow-elevated"
          >
            <div className="text-sm font-semibold text-foreground">{item.title}</div>
            <p className="mt-1 text-sm leading-7 text-muted">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
