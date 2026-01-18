import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/auth/rateLimit";
import { sendEmail } from "@/lib/auth/emailSender";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, minutesFromNow } from "@/lib/auth/tokens";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit({ key: `register:${ip}`, limit: 10, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ message: "Too many requests" }, { status: 429 });

    const body = (await req.json().catch(() => null)) as
      | { name?: string; email?: string; password?: string }
      | null;
    const email = String(body?.email ?? "").toLowerCase().trim();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim() || null;

    if (!email || !password || password.length < 8) {
      return NextResponse.json({ message: "Invalid input" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        hashedPassword,
        status: "active",
      },
    });

    const role = await prisma.role.upsert({
      where: { name: "user" },
      update: {},
      create: { name: "user" },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    const token = generateToken();
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires: minutesFromNow(60),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? `http://${req.headers.get("host") ?? "localhost:3000"}`;
    const verifyUrl = new URL("/api/auth/verify-email", baseUrl);
    verifyUrl.searchParams.set("token", token);
    verifyUrl.searchParams.set("email", email);

    await sendEmail({
      to: email,
      subject: "Verify your email",
      text: `Verify your email by visiting: ${verifyUrl.toString()}`,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Request failed" }, { status: 400 });
  }
}
