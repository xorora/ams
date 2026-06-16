import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authenticateWithCredentials } from "@/lib/auth/credentials-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        employeeCode: { label: "Employee code", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        const employeeCode = credentials?.employeeCode;
        const email = credentials?.email;
        const password = credentials?.password;
        const name = credentials?.name;

        if (
          typeof employeeCode !== "string" ||
          typeof email !== "string" ||
          typeof password !== "string"
        ) {
          return null;
        }

        try {
          const user = await authenticateWithCredentials({
            employeeCode,
            email,
            password,
            name: typeof name === "string" ? name : null,
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            employeeId: user.employeeId,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.employeeId = user.employeeId ?? null;
        return token;
      }

      if (typeof token.id === "string") {
        const [dbUser] = await db
          .select({ role: users.role, employeeId: users.employeeId })
          .from(users)
          .where(eq(users.id, token.id))
          .limit(1);

        if (dbUser) {
          token.role = dbUser.role;
          token.employeeId = dbUser.employeeId;
        }
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
