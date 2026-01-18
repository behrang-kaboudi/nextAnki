import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertSameOrigin } from "@/lib/auth/origin";
import { rateLimit } from "@/lib/auth/rateLimit";
import { sendEmail } from "@/lib/auth/emailSender";
import { generateToken, minutesFromNow } from "@/lib/auth/tokens";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = rateLimit({ key: `forgot:${ip}`, limit: 20, windowMs: 10 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ ok: true }, { status: 200 });

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = String(body?.email ?? "").toLowerCase().trim();
    if (!email) return NextResponse.json({ ok: true }, { status: 200 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "active") return NextResponse.json({ ok: true }, { status: 200 });

    const token = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: minutesFromNow(30),
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? `http://${req.headers.get("host") ?? "localhost:3000"}`;
    const resetUrl = new URL("/reset-password", baseUrl);
    resetUrl.searchParams.set("token", token);

    await sendEmail({
      to: email,
      subject: "Reset your password",
      text: `Reset your password by visiting: ${resetUrl.toString()}`,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

