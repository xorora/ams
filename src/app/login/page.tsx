import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { ModeToggle } from "@/components/mode-toggle";
import { getPostAuthRedirect } from "@/lib/auth/navigation";

const errorMessages: Record<string, string> = {
  AccessDenied:
    "Sign-in was denied. Use a verified company Google account from your Workspace domain.",
  Configuration: "Authentication is misconfigured. Contact your administrator.",
  OAuthSignin: "Could not start Google sign-in. Try again.",
  OAuthCallback: "Google sign-in failed. Try again.",
  Default: "Sign-in failed. Try again.",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user) {
    redirect(getPostAuthRedirect(session.user));
  }

  const params = await searchParams;
  const errorKey = params.error ?? "";
  const errorMessage = errorMessages[errorKey] ?? (errorKey ? errorMessages.Default : null);
  const callbackUrl = params.callbackUrl ?? "/dashboard";

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center gap-6 p-8">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">AMS</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          One sign-in for administrators and employees. Use your company Google account; your role
          is assigned automatically from your account.
        </p>
        {errorMessage && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
            {errorMessage}
          </p>
        )}
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl });
        }}
      >
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
