import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Attendance Management System</h1>
        <p className="mt-3 text-muted-foreground">
          Night-shift attendance with geofenced check-in, breaks, and admin reporting. Business
          timezone: Asia/Karachi.
        </p>
      </div>
      <Link
        href="/login"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
      >
        Sign in
      </Link>
    </div>
  );
}
