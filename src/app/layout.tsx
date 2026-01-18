import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/backup/scheduler";
import { getActiveTheme } from "@/lib/theme/themeRepository";
import { buildThemeStyleTagContent } from "@/lib/theme/themeCss";
import { defaultThemes } from "@/lib/theme/defaultThemes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anki Bridge",
  description:
    "A web UI for connecting to AnkiDroid via AnkiConnect (static-only for now).",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const activeTheme = (await getActiveTheme()) ?? {
    slug: defaultThemes[0].slug,
    variables: defaultThemes[0].variables,
  };

  return (
    <html lang="en" dir="ltr" data-theme={activeTheme.slug}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: buildThemeStyleTagContent(activeTheme.slug, activeTheme.variables),
          }}
        />
        <div className="min-h-dvh bg-background text-foreground">{children}</div>
      </body>
    </html>
  );
}
