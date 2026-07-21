import {
  BarChart3,
  CalendarDays,
  Fingerprint,
  MapPin,
  Moon,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Image from "next/image";
import { CredentialsAuthForm } from "@/components/auth/credentials-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import type { CompanyOption } from "@/lib/admin/selected-company";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Fingerprint,
    title: "Biometric machine sync",
    description:
      "Pull punches from ZKTime terminals and push new hires for device enrollment.",
  },
  {
    icon: MapPin,
    title: "Geofenced check-in",
    description: "Location verified on every check-in and check-out at the office.",
  },
  {
    icon: Moon,
    title: "Flexible shift timing",
    description:
      "Day, afternoon, and evening schedules per company and employee — all in Asia/Karachi.",
  },
  {
    icon: Timer,
    title: "Break tracking",
    description: "60-minute break cap with live remaining-time warnings.",
  },
  {
    icon: CalendarDays,
    title: "Leave management",
    description: "Annual, casual, sick, and unpaid leave with balances and approvals.",
  },
  {
    icon: ShieldCheck,
    title: "Late fine relaxations",
    description:
      "After more than three lates in a month, request a waiver — HR reviews and approves.",
  },
  {
    icon: BarChart3,
    title: "Admin reporting",
    description: "Date-range summaries, drill-downs, and Excel exports for HR.",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Sign in",
    description: "Use your work email and password, or continue with Google.",
  },
  {
    step: "02",
    title: "Link your employee number",
    description:
      "On first sign-in, confirm your company and employee code to connect your account.",
  },
  {
    step: "03",
    title: "Start tracking",
    description: "Check in from the office, manage breaks, leave, and see your attendance.",
  },
] as const;

type LandingPageProps = {
  callbackUrl: string;
  errorMessage: string | null;
  companies: CompanyOption[];
};

export function LandingPage({ callbackUrl, errorMessage, companies }: LandingPageProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#f6f7fb]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,#464c9f22,transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_85%_20%,#f26b2114,transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#dcdfea66_1px,transparent_1px),linear-gradient(to_bottom,#dcdfea66_1px,transparent_1px)] bg-size-[3.25rem_3.25rem] mask-[radial-gradient(ellipse_at_center,black,transparent_72%)] opacity-70" />
        <div className="absolute -left-28 bottom-0 size-[22rem] rounded-full bg-[#010c28]/[0.04] blur-3xl" />
      </div>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-10 md:py-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="flex flex-col gap-6">
              <div
                className={cn(
                  "flex items-center gap-3",
                  "animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both",
                )}
              >
                <Image
                  src="/xorora-full.png"
                  alt="Xorora"
                  width={280}
                  height={54}
                  sizes="(max-width: 768px) 180px, 240px"
                  className="h-8 w-auto object-contain sm:h-10"
                  priority
                />
                <p className="font-semibold text-3xl tracking-tight text-[#08080d] sm:text-4xl">
                  Punch
                </p>
              </div>

              <div
                className={cn(
                  "space-y-4",
                  "animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 fill-mode-both",
                )}
              >
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-balance text-[#08080d] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
                  Attendance for the floor and the night shift
                </h1>
                <p className="max-w-md text-base text-[#586178] text-pretty sm:text-lg">
                  Biometric sync and geofenced check-in for day and evening teams — timed in
                  Asia/Karachi.
                </p>
              </div>
            </div>

            <div
              className={cn(
                "flex flex-col gap-4",
                "animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both",
              )}
            >
              <div className="rounded-2xl border border-[#dcdfea] bg-white/90 p-6 shadow-lg shadow-[#010c28]/[0.06] backdrop-blur-sm md:p-8">
                <div className="mb-5 space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-[#08080d]">
                    Sign in
                  </h2>
                  <p className="text-[#586178] text-sm">
                    Use your work email, or continue with Google.
                  </p>
                </div>

                {errorMessage ? (
                  <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
                    {errorMessage}
                  </p>
                ) : null}

                <div className="flex flex-col gap-5">
                  <CredentialsAuthForm callbackUrl={callbackUrl} companies={companies} />

                  <div className="relative flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#dcdfea]" />
                    <span className="text-[#586178] text-xs uppercase tracking-wide">or</span>
                    <div className="h-px flex-1 bg-[#dcdfea]" />
                  </div>

                  <GoogleSignInButton
                    callbackUrl={callbackUrl}
                    className="h-12 w-full bg-[#f6f7fb] text-base font-medium shadow-sm"
                  />

                  <p className="text-center text-[#586178] text-xs leading-relaxed">
                    First-time email sign-in links your employee code; after that, use your
                    password.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#dcdfea] bg-white py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-[#08080d] md:text-3xl">
                Everything attendance needs in one place
              </h2>
              <p className="mt-3 text-[#586178]">
                From the shop floor to HR — punches, leave, relaxations, and reports.
              </p>
            </div>

            <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <li key={feature.title} className="flex flex-col gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-[#e7e9f7] text-[#464c9f]">
                    <feature.icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="font-medium text-[#08080d]">{feature.title}</h3>
                  <p className="text-[#586178] text-sm leading-relaxed">{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-[#dcdfea] bg-[#f6f7fb] py-16 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-[#08080d] md:text-3xl">
                Three steps to your first check-in
              </h2>
              <p className="mt-3 text-[#586178]">
                Sign in, link your employee number if needed, then start tracking.
              </p>
            </div>

            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {steps.map((item) => (
                <li key={item.step} className="flex flex-col gap-3">
                  <span className="font-mono text-[#f26b21] text-sm font-medium">{item.step}</span>
                  <h3 className="font-medium text-lg text-[#08080d]">{item.title}</h3>
                  <p className="text-[#586178] text-sm leading-relaxed">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dcdfea] bg-white py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-6 text-[#586178] text-sm sm:flex-row sm:items-center">
          <p className="font-medium text-[#08080d]">Xorora Punch</p>
          <p className="font-mono text-xs">Timezone: Asia/Karachi (PKT)</p>
        </div>
      </footer>
    </div>
  );
}
