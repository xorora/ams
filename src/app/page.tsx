import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { getCompanies } from "@/lib/admin/selected-company";
import { getPostAuthRedirect } from "@/lib/auth/navigation";
import { getSession } from "@/lib/auth/session";

const errorMessages: Record<string, string> = {
  AccessDenied: "Sign-in was denied. Make sure your Google account email is verified.",
  Configuration: "Authentication is misconfigured. Contact your administrator.",
  OAuthSignin: "Could not start Google sign-in. Try again.",
  OAuthCallback: "Google sign-in failed. Try again.",
  CredentialsSignin: "Invalid email or password.",
  Default: "Sign-in failed. Try again.",
};

type HomePageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();
  if (session?.user) {
    redirect(getPostAuthRedirect(session.user));
  }

  const params = await searchParams;
  const errorKey = params.error ?? "";
  const errorMessage = errorMessages[errorKey] ?? (errorKey ? errorMessages.Default : null);
  const callbackUrl = params.callbackUrl ?? "/register";
  const companies = await getCompanies();

  return (
    <LandingPage callbackUrl={callbackUrl} errorMessage={errorMessage} companies={companies} />
  );
}
