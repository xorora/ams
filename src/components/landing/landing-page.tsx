import {
  BarChart3,
  CalendarDays,
  Clock,
  MapPin,
  Moon,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CHECK_IN_GRACE_MINUTES,
  EXPECTED_CHECK_IN_TIME_PKT,
  EXPECTED_CHECK_OUT_TIME_PKT,
  formatLateCheckInDeadline,
  formatLateCheckOutDeadline,
} from "@/lib/attendance/constants";

const shiftWindowLabel = `${EXPECTED_CHECK_IN_TIME_PKT.replace(" PKT", "")} - ${EXPECTED_CHECK_OUT_TIME_PKT}`;

const features = [
  {
    icon: MapPin,
    title: "Geofenced check-in",
    description: "Location verified on every check-in and check-out at the office.",
  },
  {
    icon: Moon,
    title: "Night-shift ready",
    description: `${shiftWindowLabel} with ${CHECK_IN_GRACE_MINUTES}-minute grace windows.`,
  },
  {
    icon: Timer,
    title: "Break tracking",
    description: "60-minute break cap with live remaining-time warnings.",
  },
  {
    icon: CalendarDays,
    title: "Leave management",
    description: "Annual, casual, and sick leave with balances and approvals.",
  },
  {
    icon: BarChart3,
    title: "Admin reporting",
    description: "Date-range summaries, drill-downs, and Excel exports.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Google sign-in",
    description:
      "Sign in with any Google account — personal or work. Your employee number links you to the right company.",
  },
] as const;

const shiftFacts = [
  { label: "Check-in", value: EXPECTED_CHECK_IN_TIME_PKT },
  { label: "Late after", value: formatLateCheckInDeadline() },
  { label: "Check-out", value: EXPECTED_CHECK_OUT_TIME_PKT },
  { label: "Grace", value: `${CHECK_IN_GRACE_MINUTES} min` },
  { label: "Check-out by", value: formatLateCheckOutDeadline() },
  { label: "Max break", value: "60 min" },
] as const;

const steps = [
  {
    step: "01",
    title: "Sign in with Google",
    description: "Use your personal Gmail or any Google account — no company email required.",
  },
  {
    step: "02",
    title: "Enter your employee number",
    description: "Badge or employee code links you to your company record automatically.",
  },
  {
    step: "03",
    title: "Start tracking",
    description: "Check in from the office, manage breaks, and view leave balances.",
  },
] as const;

type LandingPageProps = {
  callbackUrl: string;
  errorMessage: string | null;
};

export function LandingPage({ callbackUrl, errorMessage }: LandingPageProps) {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.92_0.04_250/0.5),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0_0_0/0.25)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0_0_0/0.25)_1px,transparent_1px)] bg-size-[3.5rem_3.5rem] mask-[radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-55" />
        <div className="absolute -right-32 top-1/4 size-[28rem] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -left-24 bottom-1/4 size-80 rounded-full bg-muted blur-3xl" />
      </div>

      <header>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="font-semibold leading-none tracking-tight">AMS</p>
              <p className="text-muted-foreground text-xs">Attendance Management</p>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            Asia/Karachi
          </Badge>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-6 pb-20 pt-4 md:pt-10">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Sparkles className="size-3" />
                  Night-shift attendance
                </Badge>
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Clock in with confidence,&nbsp;
                <span className="text-muted-foreground">even after midnight</span>
              </h1>

              <p className="max-w-lg text-lg text-muted-foreground text-pretty">
                Geofenced check-in, break tracking, leave balances, and HR reporting — built
                for&nbsp;
                {shiftWindowLabel.replace(/ PKT/g, "")} shifts in Pakistan Standard Time.
              </p>

              <div className="flex flex-wrap gap-2">
                {shiftFacts.slice(0, 4).map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-lg border bg-card/60 px-3 py-2 backdrop-blur-sm"
                  >
                    <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                      {fact.label}
                    </p>
                    <p className="font-mono text-sm font-medium">{fact.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Card className="border-2 bg-card/80 shadow-lg backdrop-blur-sm">
                <CardContent className="flex flex-col gap-5 p-6 md:p-8">
                  <div className="space-y-1">
                    <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
                    <p className="text-muted-foreground text-sm">
                      Sign in with Google, then enter your employee number to get started.
                    </p>
                  </div>

                  {errorMessage ? (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
                      {errorMessage}
                    </p>
                  ) : null}

                  <GoogleSignInButton
                    callbackUrl={callbackUrl}
                    className="h-12 w-full bg-background text-base font-medium shadow-sm"
                  />

                  <p className="text-center text-muted-foreground text-xs leading-relaxed">
                    Any Google account works — personal Gmail or work email. Your employee number
                    determines your company assignment.
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-3">
                {shiftFacts.slice(4).map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-lg border bg-card/50 px-3 py-2.5 text-center backdrop-blur-sm"
                  >
                    <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
                      {fact.label}
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-medium">{fact.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted/20 py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Built for how your team actually works
              </h2>
              <p className="mt-3 text-muted-foreground">
                From the shop floor to HR — one system for attendance, leave, and reporting.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border bg-card/60 backdrop-blur-sm transition-colors hover:bg-card/80"
                >
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <feature.icon className="size-5" />
                    </div>
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Three steps to your first check-in
              </h2>
              <p className="mt-3 text-muted-foreground">
                No company email required — just Google and your employee number.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="relative flex flex-col gap-3">
                  <span className="font-mono text-primary text-sm font-medium">{item.step}</span>
                  <h3 className="font-medium text-lg">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-14 flex justify-center">
              <GoogleSignInButton
                callbackUrl={callbackUrl}
                className="h-12 min-w-64 bg-background text-base font-medium shadow-sm"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 text-muted-foreground text-sm sm:flex-row">
          <p>AMS — Attendance Management System</p>
          <p className="font-mono text-xs">Timezone: Asia/Karachi (PKT)</p>
        </div>
      </footer>
    </div>
  );
}
