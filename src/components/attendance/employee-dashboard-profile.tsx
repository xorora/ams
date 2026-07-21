import type { ComponentType } from "react";
import { Briefcase, Building2, Hash, Mail, MoonStar, Shield } from "lucide-react";
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
};

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#464c9f]/25 text-[#c8cce0]">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-[#9aa3b8] uppercase">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-[#eceef5]">{value}</p>
      </div>
    </div>
  );
}

type EmployeeDashboardProfileProps = {
  profile: DashboardEmployeeProfile;
  className?: string;
};

export function EmployeeDashboardProfile({ profile, className }: EmployeeDashboardProfileProps) {
  const facts = [
    { icon: Hash, label: "Employee code", value: profile.employeeCode },
    { icon: Mail, label: "Email", value: profile.email },
    profile.designation
      ? { icon: Briefcase, label: "Designation", value: profile.designation }
      : null,
    profile.department
      ? { icon: Building2, label: "Department", value: profile.department }
      : null,
    profile.companyName
      ? { icon: Building2, label: "Company", value: profile.companyName }
      : null,
    profile.shiftLabel
      ? {
          icon: MoonStar,
          label: "Shift",
          value: profile.shiftHours
            ? `${profile.shiftLabel} · ${profile.shiftHours}`
            : profile.shiftLabel,
        }
      : null,
  ].filter(Boolean) as Array<{
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    label: string;
    value: string;
  }>;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a1230] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_70%_at_0%_0%,#464c9f35,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#464c9f] via-[#f26b21] to-[#464c9f]"
      />

      <div className="relative space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#f26b21] uppercase">
              Employee
            </p>
            <h2 className="truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {profile.fullName}
            </h2>
            <p className="font-mono text-sm text-[#c8cce0]">{profile.employeeCode}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                profile.isActive
                  ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
                  : "border-amber-400/35 bg-amber-400/10 text-amber-100",
              )}
            >
              {profile.isActive ? "Active" : "Inactive"}
            </span>
            {profile.onProbation ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#f26b21]/40 bg-[#f26b21]/10 px-2.5 py-1 text-xs font-medium text-[#ffb27a]">
                <Shield className="size-3.5" strokeWidth={1.75} aria-hidden />
                On probation
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {facts.map((fact) => (
            <ProfileFact key={fact.label} icon={fact.icon} label={fact.label} value={fact.value} />
          ))}
        </div>
      </div>
    </section>
  );
}
