import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/backup/scheduler";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/Navbar";
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
  const layout = activeTheme.variables.layout;

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
        <div className="min-h-dvh bg-background text-foreground">
          {layout === "sidebar" ? (
            <div className="mx-auto flex min-h-dvh w-full max-w-screen-2xl">
              <Navbar layout={layout} />
              <div className="flex min-w-0 flex-1 flex-col">
                <main className="min-w-0 flex-1 px-4 py-10 sm:px-8">
                  {children}
                </main>
                <Footer />
              </div>
            </div>
          ) : layout === "topbar" ? (
            <div className="min-h-dvh">
              <Navbar layout={layout} />
              <main className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-8">
                {children}
              </main>
              <Footer />
            </div>
          ) : (
            <div className="min-h-dvh">
              <Navbar layout={layout} />
              <main className="mx-auto w-full max-w-screen-2xl px-4 py-10 sm:px-8">
                {children}
              </main>
              <Footer />
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
