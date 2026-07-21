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

/** Fine film grain via SVG turbulence — no external asset. */
const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

type LandingPageProps = {
  callbackUrl: string;
  errorMessage: string | null;
  companies: CompanyOption[];
};

export function LandingPage({ callbackUrl, errorMessage, companies }: LandingPageProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#f3f4f8]">
      {/* Full-bleed atmosphere + texture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_15%_-10%,#464c9f28,transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_95%_8%,#f26b2118,transparent_48%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_70%_95%,#010c280a,transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(165deg,#ffffff00_0%,#464c9f08_42%,#010c2806_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#c8cce055_1px,transparent_1px),linear-gradient(to_bottom,#c8cce055_1px,transparent_1px)] bg-size-[2.75rem_2.75rem] mask-[radial-gradient(ellipse_at_40%_20%,black_10%,transparent_70%)] opacity-80" />
        <div
          className="absolute inset-0 opacity-[0.35] mix-blend-multiply"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg,#08080d08 0 1px,transparent 1px 14px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.28] mix-blend-soft-light"
          style={{ backgroundImage: GRAIN_DATA_URI }}
        />
        <div className="absolute -left-40 top-1/3 size-[28rem] rounded-full bg-[#464c9f]/[0.07] blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 size-[22rem] rounded-full bg-[#f26b21]/[0.06] blur-3xl" />
      </div>

      <main className="relative flex flex-1 flex-col">
        <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-12 md:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="flex flex-col gap-7">
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
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-balance text-[#08080d] sm:text-4xl lg:text-[2.85rem] lg:leading-[1.1]">
                  Attendance for the floor and the night shift
                </h1>
                <p className="max-w-md text-base leading-relaxed text-[#586178] text-pretty sm:text-lg">
                  Biometric sync and geofenced check-in for day and evening teams — timed in
                  Asia/Karachi.
                </p>
                <div className="h-px w-16 bg-gradient-to-r from-[#f26b21] to-transparent" />
              </div>
            </div>

            <div
              className={cn(
                "relative",
                "animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both",
              )}
            >
              <div
                aria-hidden
                className="absolute -inset-3 rounded-[1.35rem] bg-gradient-to-br from-[#464c9f]/[0.12] via-transparent to-[#f26b21]/[0.1] blur-sm"
              />
              <div className="relative overflow-hidden rounded-2xl border border-[#d5d9e8] bg-white/85 shadow-[0_20px_50px_-24px_rgba(1,12,40,0.35)] backdrop-blur-md md:p-0">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-multiply"
                  style={{ backgroundImage: GRAIN_DATA_URI }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#464c9f]/40 to-transparent"
                />
                <div className="relative p-6 md:p-8">
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
                      className="h-12 w-full border border-[#dcdfea] bg-[#f6f7fb] text-base font-medium shadow-sm"
                    />

                    <p className="text-center text-[#586178] text-xs leading-relaxed">
                      First-time email sign-in links your employee code; after that, use your
                      password.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-t border-[#d5d9e8] bg-white/80 py-16 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.2] mix-blend-multiply"
            style={{ backgroundImage: GRAIN_DATA_URI }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px,#c8cce04d 1px,transparent 0)",
              backgroundSize: "18px 18px",
              maskImage: "linear-gradient(to bottom,black,transparent 95%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-6xl px-6">
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
                <li key={feature.title} className="group flex flex-col gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-[#dcdfea] bg-gradient-to-br from-[#e7e9f7] to-white text-[#464c9f] shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5">
                    <feature.icon className="size-5" aria-hidden />
                  </div>
                  <h3 className="font-medium text-[#08080d]">{feature.title}</h3>
                  <p className="text-[#586178] text-sm leading-relaxed">{feature.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative border-t border-[#d5d9e8] py-16 md:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#f6f7fb_0%,#eef0f6_100%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-multiply"
            style={{ backgroundImage: GRAIN_DATA_URI }}
          />
          <div className="relative mx-auto w-full max-w-6xl px-6">
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
                <li key={item.step} className="relative flex flex-col gap-3 border-l-2 border-[#f26b21]/50 pl-4">
                  <span className="font-mono text-[#f26b21] text-sm font-medium">{item.step}</span>
                  <h3 className="font-medium text-lg text-[#08080d]">{item.title}</h3>
                  <p className="text-[#586178] text-sm leading-relaxed">{item.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-[#d5d9e8] bg-white/90 py-8 backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15] mix-blend-multiply"
          style={{ backgroundImage: GRAIN_DATA_URI }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-6 text-[#586178] text-sm sm:flex-row sm:items-center">
          <p className="font-medium text-[#08080d]">Xorora Punch</p>
          <p className="font-mono text-xs">Timezone: Asia/Karachi (PKT)</p>
        </div>
      </footer>
    </div>
  );
}
