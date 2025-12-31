import { prisma } from "@/lib/prisma";

import { defaultThemes, type ThemeVariables } from "./defaultThemes";
import { parseThemeVariables } from "./parseThemeVariables";

async function ensureThemesSeeded() {
  const count = await prisma.theme.count();
  if (count > 0) return;

  await prisma.theme.createMany({
    data: defaultThemes.map((t, index) => ({
      slug: t.slug,
      name: t.name,
      isDefault: index === 0,
      variables: t.variables,
    })),
  });
}

export async function getActiveTheme(): Promise<{
  id: number;
  slug: string;
  name: string;
  variables: ThemeVariables;
} | null> {
  try {
    await ensureThemesSeeded();
    const theme = await prisma.theme.findFirst({
      where: { isDefault: true },
      orderBy: { id: "asc" },
    });
    if (!theme) return null;
    return {
      id: theme.id,
      slug: theme.slug,
      name: theme.name,
      variables: parseThemeVariables(theme.variables),
    };
  } catch {
    return null;
  }
}

export async function listThemes() {
  await ensureThemesSeeded();
  return prisma.theme.findMany({ orderBy: { id: "asc" } });
}

export async function setDefaultTheme(themeId: number) {
  await ensureThemesSeeded();
  await prisma.$transaction([
    prisma.theme.updateMany({ data: { isDefault: false } }),
    prisma.theme.update({ where: { id: themeId }, data: { isDefault: true } }),
  ]);
}

export async function deleteTheme(themeId: number) {
  await ensureThemesSeeded();
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) return;

  if (theme.isDefault) {
    const replacement = await prisma.theme.findFirst({
      where: { id: { not: themeId } },
      orderBy: { id: "asc" },
    });
    if (!replacement) {
      throw new Error("Cannot delete the only theme.");
    }

    await prisma.$transaction([
      prisma.theme.update({ where: { id: replacement.id }, data: { isDefault: true } }),
      prisma.theme.delete({ where: { id: themeId } }),
    ]);
    return;
  }

  await prisma.theme.delete({ where: { id: themeId } });
}
