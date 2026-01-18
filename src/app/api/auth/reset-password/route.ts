import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/auth/rateLimit";
import { hashPassword } from "@/lib/auth/password";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit({ key: `reset:${ip}`, limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ message: "Too many requests" }, { status: 429 });

    const body = (await req.json().catch(() => null)) as
      | { token?: string; password?: string }
      | null;
    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json({ message: "Invalid token" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { hashedPassword } }),
      prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Reset failed" }, { status: 400 });
  }
}

