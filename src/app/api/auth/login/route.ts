import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/auth/rateLimit";
import { verifyPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit({ key: `login:${ip}`, limit: 30, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ message: "Too many requests" }, { status: 429 });

    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;
    const email = String(body?.email ?? "").toLowerCase().trim();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.hashedPassword) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.hashedPassword);
    if (!ok) return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }
}

