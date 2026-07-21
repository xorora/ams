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

const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

type LandingPageProps = {
  callbackUrl: string;
  errorMessage: string | null;
  companies: CompanyOption[];
};

function Grain({ className, opacity = 0.22 }: { className?: string; opacity?: number }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 mix-blend-soft-light", className)}
      style={{ backgroundImage: GRAIN_DATA_URI, opacity }}
    />
  );
}

function HeroOrbitVisual({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <svg
        viewBox="0 0 800 800"
        className="absolute -right-[18%] top-1/2 h-[min(92vh,820px)] w-[min(92vh,820px)] -translate-y-1/2 opacity-90"
        fill="none"
      >
        <defs>
          <radialGradient id="punchCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f26b21" stopOpacity="0.35" />
            <stop offset="45%" stopColor="#464c9f" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#010c28" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ringStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f26b21" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#6b70b6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#eceef5" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <circle cx="400" cy="400" r="280" fill="url(#punchCore)" />
        <circle
          cx="400"
          cy="400"
          r="210"
          stroke="url(#ringStroke)"
          strokeWidth="1.25"
          className="origin-[400px_400px] animate-[spin_48s_linear_infinite]"
          strokeDasharray="6 14"
        />
        <circle
          cx="400"
          cy="400"
          r="265"
          stroke="#eceef5"
          strokeOpacity="0.12"
          strokeWidth="1"
          className="origin-[400px_400px] animate-[spin_72s_linear_infinite] [animation-direction:reverse]"
          strokeDasharray="2 18"
        />
        <circle
          cx="400"
          cy="400"
          r="155"
          stroke="#f26b21"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          className="origin-[400px_400px] animate-[spin_28s_linear_infinite]"
          strokeDasharray="40 220"
          strokeLinecap="round"
        />
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180);
          const inner = 118;
          const outer = index % 3 === 0 ? 138 : 130;
          return (
            <line
              key={index}
              x1={400 + Math.cos(angle) * inner}
              y1={400 + Math.sin(angle) * inner}
              x2={400 + Math.cos(angle) * outer}
              y2={400 + Math.sin(angle) * outer}
              stroke="#eceef5"
              strokeOpacity={index % 3 === 0 ? 0.45 : 0.2}
              strokeWidth={index % 3 === 0 ? 2 : 1}
            />
          );
        })}
        <circle cx="400" cy="400" r="8" fill="#f26b21" />
        <circle cx="400" cy="400" r="3.5" fill="#010c28" />
        <line
          x1="400"
          y1="400"
          x2="400"
          y2="310"
          stroke="#eceef5"
          strokeOpacity="0.7"
          strokeWidth="3"
          strokeLinecap="round"
          className="origin-[400px_400px] animate-[spin_120s_linear_infinite]"
        />
        <line
          x1="400"
          y1="400"
          x2="470"
          y2="400"
          stroke="#f26b21"
          strokeOpacity="0.9"
          strokeWidth="2"
          strokeLinecap="round"
          className="origin-[400px_400px] animate-[spin_20s_linear_infinite]"
        />
      </svg>
    </div>
  );
}

export function LandingPage({ callbackUrl, errorMessage, companies }: LandingPageProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#010c28]">
      <main className="relative flex flex-1 flex-col">
        <section className="relative isolate min-h-[100svh] overflow-hidden bg-[#010c28] text-[#eceef5]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_15%,#464c9f55,transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_88%_70%,#f26b2130,transparent_50%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#010c28_0%,#0a1230_55%,#010c28_100%)]" />
            <Grain opacity={0.22} />
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#ffffff0d 1px,transparent 1px),linear-gradient(to bottom,#ffffff0d 1px,transparent 1px)",
                backgroundSize: "4rem 4rem",
                maskImage: "radial-gradient(ellipse at 30% 40%,black,transparent 72%)",
              }}
            />
            <HeroOrbitVisual />
          </div>

          <div className="relative mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-6 py-8 md:py-10">
            <div
              className={cn(
                "mb-10 flex items-center justify-between gap-4 md:mb-14",
                "animate-in fade-in duration-700 fill-mode-both",
              )}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <Image
                  src="/xorora-full.png"
                  alt="Xorora"
                  width={320}
                  height={62}
                  sizes="(max-width: 768px) 160px, 220px"
                  className="h-7 w-auto object-contain brightness-0 invert sm:h-9"
                  priority
                />
                <span className="font-semibold text-2xl tracking-tight text-white sm:text-3xl md:text-4xl">
                  Punch
                </span>
              </div>
              <p className="hidden font-mono text-[11px] tracking-[0.18em] text-[#eceef5]/70 uppercase sm:block">
                Asia/Karachi
              </p>
            </div>

            <div className="grid flex-1 items-center gap-12 pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-16">
              <div className="relative z-10 flex max-w-xl flex-col gap-6">
                <div
                  className={cn(
                    "space-y-5",
                    "animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 fill-mode-both",
                  )}
                >
                  <h1 className="text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.35rem] lg:leading-[1.05]">
                    Attendance built for
                    <span className="mt-1 block bg-gradient-to-r from-[#f26b21] via-[#f4a574] to-[#eceef5] bg-clip-text text-transparent">
                      real shift work
                    </span>
                  </h1>
                  <p className="max-w-md text-base leading-relaxed text-[#c8cce0] text-pretty sm:text-lg">
                    Biometric sync and geofenced check-in for day and evening teams — timed in
                    Pakistan Standard Time.
                  </p>
                  <div className="h-1 w-20 rounded-full bg-gradient-to-r from-[#f26b21] to-transparent" />
                </div>
              </div>

              <div
                id="sign-in"
                className={cn(
                  "relative z-10",
                  "animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-both",
                )}
              >
                <div
                  aria-hidden
                  className="absolute -inset-4 rounded-[1.5rem] bg-gradient-to-br from-[#f26b21]/25 via-[#464c9f]/20 to-transparent blur-xl"
                />
                <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#f6f7fb] text-[#08080d] shadow-[0_30px_80px_-28px_rgba(0,0,0,0.65)]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-multiply"
                    style={{ backgroundImage: GRAIN_DATA_URI }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#464c9f] via-[#f26b21] to-[#464c9f]"
                  />
                  <div className="relative p-6 md:p-8">
                    <div className="mb-5 space-y-1">
                      <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
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
                        className="h-12 w-full border border-[#dcdfea] bg-white text-base font-medium shadow-sm"
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
          </div>
        </section>

        {/* Features — light editorial band */}
        <section className="relative overflow-hidden bg-[#eceef5] text-[#08080d]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,#464c9f22,transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_100%_100%,#f26b2114,transparent_50%)]" />
            <Grain className="mix-blend-multiply" opacity={0.18} />
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#010c2808 1px,transparent 1px),linear-gradient(to bottom,#010c2808 1px,transparent 1px)",
                backgroundSize: "3.5rem 3.5rem",
                maskImage: "linear-gradient(to bottom,black 20%,transparent 95%)",
              }}
            />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
              <div className="max-w-xl">
                <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-[#464c9f] uppercase">
                  Capabilities
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
                  Everything attendance needs in one place
                </h2>
              </div>
              <p className="max-w-sm text-[#586178] text-pretty md:pb-1 md:text-right">
                From the shop floor to HR — punches, leave, relaxations, and reports.
              </p>
            </div>

            <ul className="mt-16 grid gap-x-10 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <li
                  key={feature.title}
                  className="group relative flex flex-col gap-4 border-t border-[#c8cce0]/80 py-9"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex size-10 items-center justify-center text-[#464c9f] transition-colors duration-300 group-hover:text-[#f26b21]">
                      <feature.icon className="size-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="font-mono text-[11px] tracking-widest text-[#9aa3b8]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium tracking-tight">{feature.title}</h3>
                    <p className="text-[#586178] text-sm leading-relaxed">{feature.description}</p>
                  </div>
                  <div
                    aria-hidden
                    className="h-px w-0 bg-gradient-to-r from-[#f26b21] to-transparent transition-all duration-500 group-hover:w-16"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Steps — navy bookend */}
        <section className="relative overflow-hidden bg-[#010c28] text-[#eceef5]">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#464c9f40,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_35%_at_90%_80%,#f26b2120,transparent_45%)]" />
            <Grain opacity={0.2} />
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#ffffff0a 1px,transparent 1px),linear-gradient(to bottom,#ffffff0a 1px,transparent 1px)",
                backgroundSize: "4rem 4rem",
              }}
            />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
            <div className="max-w-2xl">
              <p className="mb-3 font-mono text-[11px] tracking-[0.2em] text-[#f26b21] uppercase">
                Get started
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-balance text-white md:text-4xl">
                Three steps to your first check-in
              </h2>
              <p className="mt-4 max-w-md text-[#a8aec4] text-pretty">
                Sign in, link your employee number if needed, then start tracking.
              </p>
            </div>

            <ol className="relative mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
              <div
                aria-hidden
                className="pointer-events-none absolute top-[1.15rem] right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-[#f26b21]/80 via-[#464c9f]/60 to-[#f26b21]/80 md:block"
              />
              {steps.map((item) => (
                <li key={item.step} className="relative flex flex-col gap-4">
                  <span className="relative z-10 flex size-9 items-center justify-center rounded-full border border-[#f26b21]/50 bg-[#010c28] font-mono text-sm font-medium text-[#f26b21]">
                    {item.step}
                  </span>
                  <h3 className="text-xl font-medium tracking-tight text-white">{item.title}</h3>
                  <p className="text-[#a8aec4] text-sm leading-relaxed">{item.description}</p>
                </li>
              ))}
            </ol>

            <div className="mt-16 flex flex-col items-start gap-4 border-t border-white/10 pt-10 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-[#a8aec4] text-sm">
                Ready for your team? Sign in above and link employee codes in minutes.
              </p>
              <a
                href="#sign-in"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-[#f26b21] px-5 text-sm font-medium text-white transition-colors hover:bg-[#e05f1a]"
              >
                Back to sign in
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 bg-[#010c28] py-8">
        <Grain opacity={0.15} />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Image
              src="/xorora-full.png"
              alt=""
              width={140}
              height={28}
              className="h-4 w-auto object-contain brightness-0 invert opacity-80"
            />
            <span className="text-sm font-medium text-white/90">Punch</span>
          </div>
          <p className="font-mono text-[11px] tracking-[0.14em] text-[#7d859e] uppercase">
            Asia/Karachi · PKT
          </p>
        </div>
      </footer>
    </div>
  );
}
