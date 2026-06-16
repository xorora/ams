import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "admin" | "employee";
    employeeId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "employee";
      employeeId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "employee";
    employeeId: string | null;
  }
}
