import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const email = (url.searchParams.get("email") ?? "").toLowerCase().trim();

  if (!token || !email) return NextResponse.redirect(new URL("/login", url));

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || record.identifier !== email || record.expires < new Date()) {
    return NextResponse.redirect(new URL("/login", url));
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { token } }),
  ]);

  const destination = new URL("/login", url);
  destination.searchParams.set("verified", "1");
  return NextResponse.redirect(destination);
}

