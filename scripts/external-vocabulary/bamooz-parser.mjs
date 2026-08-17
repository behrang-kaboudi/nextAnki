const NAMED_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  lt: "<",
  nbsp: " ",
  quot: '"',
  raquo: "»",
  rsquo: "’",
};

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, body) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function textContent(value) {
  return decodeEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
      .replace(/<[^>]+>/gu, " "),
  ).replace(/\s+/gu, " ").trim();
}

function withoutLeadingIndex(value) {
  return value.replace(/^\s*\d+\s*[.)-]?\s*/u, "").trim();
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractExamples(segment) {
  const examples = [];
  const patterns = [
    /<div[^>]*class="[^"]*example-box[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<span[^>]*class="[^"]*translation-example-box[^"]*"[^>]*>([\s\S]*?)<\/span>/giu,
    /<div[^>]*class="[^"]*prepositioned-form(?:\s[^"]*)?"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<div[^>]*class="[^"]*prepositioned-form-translation[^"]*"[^>]*>([\s\S]*?)<\/div>/giu,
  ];
  for (const pattern of patterns) {
    for (const match of segment.matchAll(pattern)) {
      const sentenceEn = withoutLeadingIndex(textContent(match[1]));
      const sentenceFa = withoutLeadingIndex(textContent(match[2]));
      if (sentenceEn && sentenceFa && /[A-Za-z]/u.test(sentenceEn)) {
        examples.push({ sentence_en: sentenceEn, sentence_en_meaning_fa: sentenceFa });
      }
    }
  }
  const seen = new Set();
  return examples.filter((example) => {
    const key = `${example.sentence_en}\u0000${example.sentence_en_meaning_fa}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractDictionaryEquivalents(segment) {
  return unique(
    [...segment.matchAll(/<a[^>]*href="[^"]*\/dictionary\/rw\?word=[^"]+"[^>]*>([\s\S]*?)<\/a>/giu)]
      .map((match) => textContent(match[1])),
  );
}

function posFromSegment(segment) {
  const classMatch = segment.match(/translation-index\s+pos-([a-z-]+)-bg/iu);
  if (classMatch?.[1]) return classMatch[1].replaceAll("-", " ");
  const anchorMatch = segment.match(/name="[^"]+_([a-z-]+)_\d+"/iu);
  return anchorMatch?.[1]?.replaceAll("-", " ") ?? "";
}

export function parseBamoozDictionaryHtml(html, term) {
  const description = textContent(html.match(/<meta\s+name="Description"\s+content="([^"]*)"/iu)?.[1] ?? "");
  const starts = [...html.matchAll(/<a[^>]*class="anchors"[^>]*name="[^"]+"[^>]*><\/a>/giu)]
    .map((match) => match.index)
    .filter((index) => typeof index === "number");
  const senses = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = starts[index + 1] ?? html.length;
    const segment = html.slice(start, end);
    const heading = segment.match(/<h2[^>]*>([\s\S]*?)<\/h2>/iu)?.[1] ?? "";
    const numberText = textContent(heading.match(/translation-index[^>]*>([\s\S]*?)<\/span>/iu)?.[1] ?? "");
    const primaryMeaning = textContent(heading.match(/<strong>([\s\S]*?)<\/strong>/iu)?.[1] ?? "");
    if (!primaryMeaning) continue;
    const summaryAlternatives = textContent(heading.match(/<small>([\s\S]*?)<\/small>/iu)?.[1] ?? "")
      .split(/[،؛]/u)
      .map((value) => value.trim())
      .filter(Boolean);
    const dictionaryEquivalents = extractDictionaryEquivalents(segment);
    senses.push({
      sense_number: Number.parseInt(numberText, 10) || senses.length + 1,
      pos: posFromSegment(segment),
      meaning_fa: primaryMeaning,
      other_meanings_fa: unique([...summaryAlternatives, ...dictionaryEquivalents])
        .filter((value) => value !== primaryMeaning),
      examples: extractExamples(segment),
    });
  }

  return {
    term,
    description,
    senses,
    parse_status: senses.length ? "parsed" : description ? "description_only" : "empty",
  };
}

