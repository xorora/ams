import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LandingPage } from "@/components/landing/landing-page";
import { getPostAuthRedirect } from "@/lib/auth/navigation";

const errorMessages: Record<string, string> = {
  CredentialsSignin: "Invalid employee code, email, or password.",
  Configuration: "Authentication is misconfigured. Contact your administrator.",
  Default: "Sign-in failed. Try again.",
};

type HomePageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  if (session?.user) {
    redirect(getPostAuthRedirect(session.user));
  }

  const params = await searchParams;
  const errorKey = params.error ?? "";
  const errorMessage = errorMessages[errorKey] ?? (errorKey ? errorMessages.Default : null);
  const callbackUrl = params.callbackUrl ?? "/dashboard";

  return <LandingPage callbackUrl={callbackUrl} errorMessage={errorMessage} />;
}
