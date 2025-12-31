export type ThemeLayout = "sidebar" | "topbar" | "focus";

export type ThemeVariables = {
  layout: ThemeLayout;
  css: Record<string, string>;
};

export type DefaultTheme = {
  slug: string;
  name: string;
  variables: ThemeVariables;
};

export const defaultThemes: DefaultTheme[] = [
  {
    slug: "aurora",
    name: "Aurora (Sidebar)",
    variables: {
      layout: "sidebar",
      css: {
        "--background": "#f6f7fb",
        "--foreground": "#0f172a",
        "--muted": "#475569",
        "--card": "#ffffff",
        "--card-border": "rgba(15, 23, 42, 0.08)",
        "--primary": "#2563eb",
        "--primary-foreground": "#ffffff",
        "--ring": "rgba(37, 99, 235, 0.28)",
        "--shadow": "0 18px 50px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  {
    slug: "noir",
    name: "Noir (Topbar)",
    variables: {
      layout: "topbar",
      css: {
        "--background": "#070a12",
        "--foreground": "#e9ecf5",
        "--muted": "#a7b0c7",
        "--card": "rgba(255, 255, 255, 0.06)",
        "--card-border": "rgba(255, 255, 255, 0.12)",
        "--primary": "#22c55e",
        "--primary-foreground": "#06130b",
        "--ring": "rgba(34, 197, 94, 0.28)",
        "--shadow": "0 18px 50px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  {
    slug: "paper",
    name: "Paper (Focus)",
    variables: {
      layout: "focus",
      css: {
        "--background": "#fbfaf7",
        "--foreground": "#111827",
        "--muted": "#6b7280",
        "--card": "#ffffff",
        "--card-border": "rgba(17, 24, 39, 0.08)",
        "--primary": "#111827",
        "--primary-foreground": "#ffffff",
        "--ring": "rgba(17, 24, 39, 0.18)",
        "--shadow": "0 12px 30px rgba(17, 24, 39, 0.06)",
      },
    },
  },
];

