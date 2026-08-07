type AnkiScoreColumnIconProps = {
  metric:
    | "learningDepth"
    | "imageability"
    | "productiveTarget"
    | "productiveLearningAverage"
    | "threeFieldAverage";
};

const SCORE_METRICS = {
  learningDepth: { icon: "🧠", label: "learning_depth" },
  imageability: { icon: "🖼️", label: "imageability" },
  productiveTarget: { icon: "🎯", label: "productive_target" },
  productiveLearningAverage: {
    icon: "⚖️",
    label: "PT+LD Avg: average of productive_target and learning_depth × 100",
  },
  threeFieldAverage: {
    icon: "📊",
    label:
      "LD+IM+PT Avg: average of learning_depth × 100, imageability, and productive_target",
  },
} as const;

export function AnkiScoreColumnIcon({ metric }: AnkiScoreColumnIconProps) {
  const item = SCORE_METRICS[metric];
  return (
    <span
      aria-label={item.label}
      title={item.label}
      className="inline-flex min-w-6 cursor-help justify-center text-base"
    >
      <span aria-hidden="true">{item.icon}</span>
    </span>
  );
}
