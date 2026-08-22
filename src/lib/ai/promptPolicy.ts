export const GLOBAL_AMERICAN_ENGLISH_POLICY_START =
  "<!-- GLOBAL_AMERICAN_ENGLISH_POLICY_V1 -->";
export const GLOBAL_AMERICAN_ENGLISH_POLICY_END =
  "<!-- /GLOBAL_AMERICAN_ENGLISH_POLICY_V1 -->";

const GLOBAL_POLICY_BLOCK_RE =
  /<!-- GLOBAL_AMERICAN_ENGLISH_POLICY_V1 -->[\s\S]*?<!-- \/GLOBAL_AMERICAN_ENGLISH_POLICY_V1 -->\s*/g;

export function combinePromptParts(parts: readonly string[]) {
  let keptGlobalPolicy = false;
  return parts
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      if (!trimmed.includes(GLOBAL_AMERICAN_ENGLISH_POLICY_START)) {
        return trimmed;
      }
      if (!keptGlobalPolicy) {
        keptGlobalPolicy = true;
        return trimmed;
      }
      return trimmed.replace(GLOBAL_POLICY_BLOCK_RE, "").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}
