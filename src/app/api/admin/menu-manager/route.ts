import "server-only";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  readEditableMenus,
  validateEditableMenus,
  writeEditableMenus,
} from "@/lib/menus/menuRepository";
import { menuIconNames } from "@/menus/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const menus = await readEditableMenus();
    return NextResponse.json({ ok: true, menus, iconNames: menuIconNames });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const menus = validateEditableMenus((body as { menus?: unknown } | null)?.menus);
    const saved = await writeEditableMenus(menus);
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    return NextResponse.json({ ok: true, menus: saved, iconNames: menuIconNames });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
