import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedHostedDomain, isAllowedWorkspaceEmail } from "@/lib/auth/domain";
import { resolveUserOnSignIn } from "@/lib/auth/resolve-user";
import { getWorkspaceDomain } from "@/lib/env";

const workspaceDomain = getWorkspaceDomain();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { hd: workspaceDomain },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      if (!profile?.email || profile.email_verified !== true) {
        return false;
      }

      if (!isAllowedWorkspaceEmail(profile.email, profile.email_verified === true)) {
        return false;
      }

      const hostedDomain =
        typeof profile.hd === "string"
          ? profile.hd
          : typeof (profile as { hostedDomain?: string }).hostedDomain === "string"
            ? (profile as { hostedDomain?: string }).hostedDomain
            : undefined;

      return isAllowedHostedDomain(hostedDomain);
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email && profile.sub) {
        const dbUser = await resolveUserOnSignIn({
          email: profile.email,
          name: profile.name,
          image: profile.picture,
          googleSubject: profile.sub,
        });

        token.id = dbUser.id;
        token.role = dbUser.role;
        token.employeeId = dbUser.employeeId;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string" && typeof token.role === "string") {
        session.user.id = token.id;
        session.user.role = token.role as "admin" | "employee";
        session.user.employeeId = typeof token.employeeId === "string" ? token.employeeId : null;
      }

      return session;
    },
  },
});
