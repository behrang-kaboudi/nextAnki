import type { ThemeVariables } from "./defaultThemes";

export function themeVariablesToCss(variables: ThemeVariables) {
  const entries = Object.entries(variables.css);
  return entries.map(([key, value]) => `${key}: ${value};`).join("\n");
}

export function buildThemeStyleTagContent(slug: string, variables: ThemeVariables) {
  return `[data-theme="${slug}"]{\n${themeVariablesToCss(variables)}\n}`;
}
