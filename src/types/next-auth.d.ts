import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/db/schema";

declare module "next-auth" {
  interface User {
    role: UserRole;
    employeeId: string | null;
    assignedCompanyId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      employeeId: string | null;
      assignedCompanyId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    employeeId: string | null;
    assignedCompanyId: string | null;
  }
}
