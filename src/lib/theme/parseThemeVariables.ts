import { defaultThemes, type ThemeVariables } from "./defaultThemes";

export function parseThemeVariables(value: unknown): ThemeVariables {
  if (!value || typeof value !== "object") return defaultThemes[0].variables;
  const maybe = value as Partial<ThemeVariables>;
  if (!maybe.layout || typeof maybe.layout !== "string") return defaultThemes[0].variables;
  if (!maybe.css || typeof maybe.css !== "object") return defaultThemes[0].variables;
  return {
    layout: maybe.layout as ThemeVariables["layout"],
    css: maybe.css as ThemeVariables["css"],
  };
}

