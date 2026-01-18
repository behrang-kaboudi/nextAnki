import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Apple from "next-auth/providers/apple";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Nodemailer from "next-auth/providers/nodemailer";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { providerCatalog } from "@/lib/providers/providerCatalog";
import { sendEmail } from "@/lib/auth/emailSender";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            roles: {
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        });

        if (!user?.hashedPassword) return null;
        if (user.status !== "active") return null;

        const ok = await verifyPassword(password, user.hashedPassword);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
    ...(providerCatalog.find((p) => p.id === "email")?.enabled
      ? [
          Nodemailer({
            from: process.env.EMAIL_FROM,
            server: process.env.SMTP_URL ?? {
              host: process.env.SMTP_HOST,
              port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
              auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
            },
            async sendVerificationRequest({ identifier, url, provider }) {
              const subject = "Your sign-in link";
              const text = `Sign in by visiting: ${url}\n\nIf you did not request this, you can ignore this email.`;
              await sendEmail({ to: identifier, subject, text });
            },
          }),
        ]
      : []),
    ...(providerCatalog.find((p) => p.id === "google")?.enabled
      ? [Google({ allowDangerousEmailAccountLinking: false })]
      : []),
    ...(providerCatalog.find((p) => p.id === "apple")?.enabled
      ? [Apple({ allowDangerousEmailAccountLinking: false })]
      : []),
    ...(providerCatalog.find((p) => p.id === "microsoft-entra-id")?.enabled
      ? [
          MicrosoftEntraID({
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
            allowDangerousEmailAccountLinking: false,
          }),
        ]
      : []),
    ...(providerCatalog.find((p) => p.id === "github")?.enabled
      ? [GitHub({ allowDangerousEmailAccountLinking: false })]
      : []),
  ],
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;
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
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { status: true },
      });

      if (dbUser && dbUser.status !== "active") return false;

      if (account?.provider !== "credentials") {
        const verified = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { emailVerified: true },
        });
        if (verified && !verified.emailVerified) {
          await prisma.user.update({
            where: { email: user.email.toLowerCase() },
            data: { emailVerified: new Date() },
          });
        }
      }

      return true;
    },
    async jwt({ token }) {
      const email = typeof token.email === "string" ? token.email.toLowerCase() : null;
      if (!email) return token;

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          },
        },
      });

      if (!user) return token;

      const roles = user.roles.map((ur) => ur.role.name);
      const permissions = user.roles
        .flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.name))
        .filter((p, idx, arr) => arr.indexOf(p) === idx);

      token.userId = user.id;
      token.roles = roles;
      token.permissions = permissions;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : "";
        session.user.roles = Array.isArray(token.roles) ? (token.roles as string[]) : [];
        session.user.permissions = Array.isArray(token.permissions)
          ? (token.permissions as string[])
          : [];
      }
      return session;
    },
  },
});
