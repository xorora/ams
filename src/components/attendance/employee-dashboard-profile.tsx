import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardEmployeeProfile = {
  fullName: string;
  employeeCode: string;
  email: string;
  department: string | null;
  designation: string | null;
  companyName: string | null;
  shiftLabel: string | null;
  shiftHours: string | null;
  isActive: boolean;
  onProbation: boolean;
  probationCompleted: boolean;
};

type EmployeeDashboardProfileProps = {
  profile: DashboardEmployeeProfile;
  className?: string;
};

/** Compact above-the-fold identity strip — welcome + key employee facts. */
export function EmployeeDashboardProfile({ profile, className }: EmployeeDashboardProfileProps) {
  const firstName = profile.fullName.trim().split(/\s+/)[0] || profile.fullName;
  const meta = [
    profile.employeeCode,
    profile.designation,
    profile.department,
    profile.companyName,
    profile.shiftLabel
      ? profile.shiftHours
        ? `${profile.shiftLabel} · ${profile.shiftHours}`
        : profile.shiftLabel
      : null,
  ].filter(Boolean);

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230] px-4 py-3.5 sm:px-5 sm:py-4",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_0%,#464c9f35,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#464c9f] via-[#f26b21] to-[#464c9f]"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              Asia/Karachi · PKT
            </p>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                profile.isActive
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-400/35 bg-amber-400/10 text-amber-100",
              )}
            >
              {profile.isActive ? "Active" : "Inactive"}
            </span>
            {profile.onProbation ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#f26b21]/40 bg-[#f26b21]/10 px-2 py-0.5 text-[11px] font-medium text-[#ffb27a]">
                <Shield className="size-3" strokeWidth={1.75} aria-hidden />
                Probation
              </span>
            ) : null}
            {profile.probationCompleted ? (
              <span className="inline-flex items-center rounded-full border border-[#d4a017]/50 bg-gradient-to-r from-[#c9a227]/25 to-[#f0d060]/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#f5e6a3] shadow-[0_0_12px_-4px_rgba(212,160,23,0.55)]">
                Permanent
              </span>
            ) : null}
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Welcome, {firstName}
          </h1>
          <p className="truncate text-sm text-[#d7dceb]">
            <span className="font-medium text-white">{profile.fullName}</span>
            {meta.length > 0 ? (
              <span className="text-[#9aa3b8]"> · {meta.join(" · ")}</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-[#9aa3b8]">{profile.email}</p>
        </div>
      </div>
    </header>
  );
}
