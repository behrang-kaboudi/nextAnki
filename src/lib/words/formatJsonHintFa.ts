type JsonHintShape = {
  person?: { fa?: unknown } | null;
  adj?: { fa?: unknown } | null;
  job?: { fa?: unknown } | null;
  persianImage?: { fa?: unknown } | null;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function addYeIfEndsWithVavOrAlef(value: string): string {
  const last = value.at(-1);
  if (last === "و" || last === "ا") return `${value}ی`;
  return value;
}

export function parseJsonHint(jsonHint: unknown): JsonHintShape | null {
  if (jsonHint == null) return null;

  if (typeof jsonHint === "string") {
    const raw = jsonHint.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw) as JsonHintShape;
    } catch {
      return null;
    }
  }

  if (typeof jsonHint === "object") return jsonHint as JsonHintShape;
  return null;
}

export function formatPersonAdjJobFa(obj: JsonHintShape | null | undefined): string | null {
  const personFaRaw = asNonEmptyString(obj?.person?.fa);
  const personFa = personFaRaw ? addYeIfEndsWithVavOrAlef(personFaRaw) : null;

  const parts = [
    personFa,
    asNonEmptyString(obj?.adj?.fa),
    asNonEmptyString(obj?.job?.fa),
  ].filter((v): v is string => Boolean(v));

  if (parts.length === 0) return null;
  return parts.join(" ");
}

export function formatJsonHintFa(jsonHint: unknown): string | null {
  const obj = parseJsonHint(jsonHint);
  const basePhrase = formatPersonAdjJobFa(obj);
  const persianImageFa = asNonEmptyString(obj?.persianImage?.fa);

  const parts: string[] = [];
  if (basePhrase) parts.push(basePhrase);
  if (persianImageFa) {
    parts.push("کنار");
    parts.push(persianImageFa);
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}
