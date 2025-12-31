import { revalidatePath } from "next/cache";

import type { Theme } from "@prisma/client";

import { buildThemeStyleTagContent } from "@/lib/theme/themeCss";
import { deleteTheme, listThemes, setDefaultTheme } from "@/lib/theme/themeRepository";
import { parseThemeVariables } from "@/lib/theme/parseThemeVariables";
import { DeleteThemeForm } from "@/components/admin/DeleteThemeForm";

export const metadata = {
  title: "Designs | Admin",
};

export default async function AdminThemesPage() {
  async function setDefaultThemeAction(formData: FormData) {
    "use server";
    const idRaw = formData.get("themeId");
    const themeId = Number(idRaw);
    if (!Number.isFinite(themeId)) return;
    await setDefaultTheme(themeId);
    revalidatePath("/", "layout");
    revalidatePath("/admin/themes");
  }

  async function deleteThemeAction(formData: FormData) {
    "use server";
    const idRaw = formData.get("themeId");
    const themeId = Number(idRaw);
    if (!Number.isFinite(themeId)) return;
    await deleteTheme(themeId);
    revalidatePath("/", "layout");
    revalidatePath("/admin/themes");
  }

  let themes: Theme[] = [];
  let error: string | null = null;
  try {
    themes = await listThemes();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Designs
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted">
          Three distinct designs (including layout) are available. Choose the default design here.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">
          Database/Prisma error: {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => {
          const variables = parseThemeVariables(theme.variables);
          const primary = variables.css["--primary"];
          const primaryForeground = variables.css["--primary-foreground"];
          const cardBorder = variables.css["--card-border"];
          const background = variables.css["--background"];
          const foreground = variables.css["--foreground"];
          const muted = variables.css["--muted"];

          return (
            <section
              key={theme.id}
              className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {theme.name}
                    </div>
                    <div className="mt-1 text-xs text-muted">{theme.slug}</div>
                    <div className="mt-1 text-xs text-muted">
                      Layout: {variables.layout}
                    </div>
                  </div>
                  {theme.isDefault ? (
                    <span className="rounded-full border border-card bg-background px-2 py-1 text-xs text-foreground">
                      Default
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border border-card"
                    style={{ background: primary }}
                  />
                  <span className="text-xs text-muted">Primary preview</span>
                </div>

                <form action={setDefaultThemeAction} className="mt-4">
                  <input type="hidden" name="themeId" value={theme.id} />
                  <button
                    type="submit"
                    disabled={theme.isDefault}
                    className="w-full rounded-xl px-3 py-2 text-sm font-semibold shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                    style={{
                      background: primary,
                      color: primaryForeground,
                    }}
                  >
                    Set as default
                  </button>
                </form>

                <DeleteThemeForm
                  themeId={theme.id}
                  action={deleteThemeAction}
                  className="mt-2"
                />
              </div>

              <div className="border-t border-card bg-background p-3">
                <div className="text-xs text-muted">Mini preview</div>
                <div className="mt-2 overflow-hidden rounded-xl border border-card bg-card">
                  <style
                    dangerouslySetInnerHTML={{
                      __html: buildThemeStyleTagContent(theme.slug, variables),
                    }}
                  />
                  <div data-theme={theme.slug} className="p-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="text-sm font-semibold"
                        style={{ color: foreground }}
                      >
                        Card Title
                      </div>
                      <div
                        className="rounded-lg px-2 py-1 text-xs"
                        style={{
                          border: `1px solid ${cardBorder}`,
                          background,
                          color: foreground,
                        }}
                      >
                        Badge
                      </div>
                    </div>
                    <div className="mt-2 text-xs" style={{ color: muted }}>
                      Background / foreground / primary sample
                    </div>
                    <div className="mt-3 flex gap-2">
                      <div
                        className="h-8 flex-1 rounded-lg"
                        style={{ border: `1px solid ${cardBorder}`, background }}
                      />
                      <div
                        className="h-8 flex-1 rounded-lg"
                        style={{ background: "var(--primary)" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
