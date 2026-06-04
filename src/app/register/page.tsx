import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";
import { ModeToggle } from "@/components/mode-toggle";
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

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Link your account</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Your company Google sign-in succeeded. Enter the employee code from HR to connect your
          account to your attendance record.
        </p>
      </div>
      <RegisterForm email={email} name={session.user.name} />
    </div>
  );
}
