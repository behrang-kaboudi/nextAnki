"use client";

type SpecialCharactersBarProps = {
  characters: readonly string[];
  onPick: (character: string) => void;
  title?: string;
  helpText?: string;
  className?: string;
};

export function SpecialCharactersBar({
  characters,
  onPick,
  title = "Special characters",
  helpText = "Click a field, then click a character.",
  className,
}: SpecialCharactersBarProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-2xl border border-card bg-card p-3 shadow-elevated ${
        className ?? ""
      }`}
    >
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {characters.map((character) => (
        <button
          key={character}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(character);
          }}
          className="rounded-xl border border-card bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition hover:bg-card"
        >
          {character}
        </button>
      ))}
      <div className="ml-auto text-xs text-muted">{helpText}</div>
    </div>
  );
}

