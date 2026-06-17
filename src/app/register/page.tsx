import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { getCompanies } from "@/lib/admin/selected-company";
import {
  getDefaultAuthenticatedPath,
  getPostAuthRedirect,
  needsEmployeeRegistration,
} from "@/lib/auth/navigation";

export default async function RegisterPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/?callbackUrl=/register");
  }

  if (!needsEmployeeRegistration(session.user)) {
    redirect(getPostAuthRedirect(session.user));
  }

  if (session.user.role !== "employee") {
    redirect(getDefaultAuthenticatedPath(session.user.role));
  }

  const email = session.user.email;
  if (!email) {
    redirect("/");
  }

  const companies = await getCompanies();
  if (companies.length === 0) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Registration unavailable</h1>
        <p className="max-w-md text-muted-foreground text-sm">
          No companies are configured yet. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--muted)_0%,transparent_55%)]"
      />
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your registration</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Select your company and enter your employee number. Matching is case-insensitive. If no
          record exists, we create one and assign you a new employee number.
        </p>
      </div>
      <RegisterForm email={email} name={session.user.name} companies={companies} />
    </div>
  );
}
