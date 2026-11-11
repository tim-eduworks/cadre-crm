import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { db } from "@/server/db";

export const ALLOWED_DOMAIN = (process.env.ALLOWED_DOMAIN ?? "eduworks.com").toLowerCase();
export const DEV_LOGIN = process.env.DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const providers: Provider[] = [
  Google({
    // `hd` only pre-selects the Workspace account in Google's UI; the real check is in the signIn callback.
    authorization: { params: { hd: ALLOWED_DOMAIN, prompt: "select_account" } },
  }),
];
if (DEV_LOGIN) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: {} },
      authorize: async (c) => {
        const email = String(c?.email ?? "").trim().toLowerCase();
        if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) return null;
        return { id: email, email, name: email.split("@")[0].replace(/[._]/g, " ") };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        return profile?.email_verified === true && String(profile?.hd ?? "").toLowerCase() === ALLOWED_DOMAIN;
      }
      return account?.provider === "dev" && DEV_LOGIN;
    },
    async jwt({ token, user, account }) {
      if (account && user?.email) {
        const email = user.email.toLowerCase();
        const isAdmin = adminEmails().includes(email);
        const dbUser = await db.user.upsert({
          where: { email },
          update: { name: user.name ?? undefined, image: user.image ?? undefined, ...(isAdmin ? { role: "ADMIN" } : {}) },
          create: { email, name: user.name, image: user.image, role: isAdmin ? "ADMIN" : "MEMBER" },
        });
        token.uid = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
