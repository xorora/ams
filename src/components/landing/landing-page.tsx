import { BarChart3, CalendarDays, Clock, MapPin, Moon, Shield, Timer } from "lucide-react";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CHECK_IN_GRACE_MINUTES, formatLateCheckInDeadline } from "@/lib/attendance/constants";

const features = [
  {
    icon: MapPin,
    title: "Geofenced check-in",
    description:
      "Check in and out from the office only. Location is verified on every attendance action.",
  },
  {
    icon: Moon,
    title: "Built for night shifts",
    description:
      "Shift window runs 18:00 to 03:00 PKT with a 15-minute check-in grace period and early-leave detection.",
  },
  {
    icon: Timer,
    title: "Break tracking",
    description:
      "Start and end breaks during your shift with a 60-minute cap and remaining-time warnings.",
  },
  {
    icon: CalendarDays,
    title: "Leave management",
    description:
      "Annual, casual, and sick leave with balance tracking, approvals, and attendance sync.",
  },
  {
    icon: BarChart3,
    title: "Admin reporting",
    description:
      "Date-range summaries, per-employee drill-downs, and Excel exports for HR and payroll.",
  },
  {
    icon: Shield,
    title: "Workspace SSO",
    description:
      "Sign in with your company Google account. Roles and employee records are linked automatically.",
  },
] as const;

const shiftFacts = [
  { label: "Check-in", value: "18:00 PKT" },
  { label: "Late after", value: formatLateCheckInDeadline() },
  { label: "Check-in grace", value: `${CHECK_IN_GRACE_MINUTES} min` },
  { label: "Check-out", value: "03:00 PKT" },
  { label: "Max break", value: "60 min" },
] as const;

const steps = [
  {
    step: "01",
    title: "Sign in with Google",
    description: "Use your company Workspace account. Only verified domain users can access AMS.",
  },
  {
    step: "02",
    title: "Link your employee code",
    description:
      "Enter the code provided by HR on first login, or get auto-linked if your email is already on file.",
  },
  {
    step: "03",
    title: "Track attendance",
    description:
      "Check in from the office, manage breaks, apply for leave, and let admins handle the rest.",
  },
] as const;

type LandingPageProps = {
  callbackUrl: string;
  errorMessage: string | null;
};

export function LandingPage({ callbackUrl, errorMessage }: LandingPageProps) {
  return (
    <div className="relative flex min-h-svh flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-background/60" />
        <div className="absolute -top-32 left-1/2 h-112 w-3xl -translate-x-1/2 rounded-full bg-muted/60 blur-3xl dark:bg-muted/30" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4rem_4rem] mask-[radial-gradient(ellipse_at_center,black,transparent_75%)] opacity-50" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Clock className="size-4" />
          </div>
          <div>
            <p className="font-medium leading-none tracking-tight">AMS</p>
            <p className="text-muted-foreground text-xs">Attendance Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Asia/Karachi
          </Badge>
          <ModeToggle />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8 md:pt-14">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-5">
              Night-shift attendance for your team
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl">
              Attendance that fits the{" "}
              <span className="text-muted-foreground">graveyard shift</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground text-pretty">
              Geofenced check-in, break tracking, leave balances, and admin reporting — all
              calibrated for 18:00–03:00 shifts in Pakistan Standard Time.
            </p>

            {errorMessage ? (
              <p className="mx-auto mt-6 max-w-xl rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col items-center gap-3">
              <GoogleSignInButton callbackUrl={callbackUrl} />
              <p className="max-w-md text-muted-foreground text-sm">
                Company Google account required. Your role is assigned automatically after sign-in.
              </p>
            </div>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {shiftFacts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-xl border bg-card/80 px-4 py-3 text-center backdrop-blur-sm"
              >
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  {fact.label}
                </p>
                <p className="mt-1 font-medium">{fact.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Everything your team needs
              </h2>
              <p className="mt-3 text-muted-foreground">
                From the shop floor to HR — one system for attendance, leave, and reporting.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-card/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted">
                      <feature.icon className="size-4 text-foreground" />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Get started</h2>
              <p className="mt-3 text-muted-foreground">
                Three steps from sign-in to your first check-in.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((item, index) => (
                <div key={item.step} className="relative flex flex-col gap-3">
                  {index < steps.length - 1 ? (
                    <Separator className="absolute top-5 left-[calc(50%+2rem)] hidden w-[calc(100%-4rem)] md:block" />
                  ) : null}
                  <span className="font-mono text-muted-foreground text-sm">{item.step}</span>
                  <h3 className="font-medium text-lg">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <Card className="w-full max-w-xl bg-card/80 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                  <CardTitle className="text-lg">Ready to clock in?</CardTitle>
                  <CardDescription>
                    Sign in with your Workspace account to open your dashboard or admin panel.
                  </CardDescription>
                  <GoogleSignInButton callbackUrl={callbackUrl} />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 text-muted-foreground text-sm sm:flex-row">
          <p>AMS — Attendance Management System</p>
          <p>Timezone: Asia/Karachi (PKT)</p>
        </div>
      </footer>
    </div>
  );
}
