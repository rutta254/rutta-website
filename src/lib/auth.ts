import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER || {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT || 465),
        secure: Number(process.env.EMAIL_SERVER_PORT || 465) === 465,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return true;

      const normalizedEmail = user.email.trim().toLowerCase();

      const existingUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
        include: { accounts: true },
      });

      // Restrict RG000 / the_subSaharan@proton.me to email-only sign-in
      const isRg000Admin =
        existingUser?.username === "RG000" ||
        normalizedEmail === "the_subsaharan@proton.me";

      if (isRg000Admin && account?.provider && account.provider !== "email") {
        return false;
      }

      if (existingUser && account && account.provider !== "email") {
        const alreadyLinked = existingUser.accounts.some(
          (a) => a.provider === account.provider
        );

        if (!alreadyLinked) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            },
          });
        }
      }

      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      if (!token.id && token.email) {
        const byEmail = await prisma.user.findFirst({
          where: {
            email: {
              equals: token.email.trim().toLowerCase(),
              mode: "insensitive",
            },
          },
        });
        if (byEmail) token.id = byEmail.id;
      }
      if (user || trigger === "update" || !token.role) {
        if (token.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          token.role = dbUser?.role ?? "CLIENT";
          token.profileComplete = dbUser?.profileComplete ?? false;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "CLIENT";
        session.user.profileComplete = Boolean(token.profileComplete);
      }
      return session;
    },
  },
};