import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  attendanceStatusBadgeVariant,
  formatAttendanceStatus,
  PKT_TIME_12H_FORMAT,
} from "@/lib/admin/display";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type EmployeeDashboardWeekAttendanceProps = {
  days: SerializedEmployeeReport["days"];
  range: { from: string; to: string };
  summary: SerializedEmployeeReport["summary"] | null;
};

function formatShiftDayLabel(shiftDate: string): string {
  const noon = fromZonedTime(`${shiftDate} 12:00:00`, BUSINESS_TIMEZONE);
  return formatInTimeZone(noon, BUSINESS_TIMEZONE, "EEE d MMM");
}

function formatCheckTime(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, PKT_TIME_12H_FORMAT);
}

export function EmployeeDashboardWeekAttendance({
  days,
  range,
  summary,
}: EmployeeDashboardWeekAttendanceProps) {
  const sortedDays = [...days].sort((a, b) => a.shiftDate.localeCompare(b.shiftDate));

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_100%_0%,#464c9f28,transparent_55%)]"
      />

      <div className="relative space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              This week
            </p>
            <h2 className="text-base font-semibold text-white">Attendance</h2>
            <p className="mt-0.5 font-mono text-xs text-[#9aa3b8]">
              {range.from} → {range.to}
              {summary ? (
                <span className="text-[#d7dceb]">
                  {" "}
                  · {summary.present} present · {summary.late} late
                  {summary.lateFinePkr > 0
                    ? ` · ${formatLateFinePkr(summary.lateFinePkr)} fines`
                    : ""}
                </span>
              ) : null}
            </p>
          </div>
          <Link
            href="/attendance/history"
            className="shrink-0 rounded-lg border border-[#f26b21]/40 bg-[#f26b21]/10 px-2.5 py-1.5 text-xs font-semibold text-[#ffb27a] hover:bg-[#f26b21]/20 hover:text-white"
          >
            View more
          </Link>
        </div>

        {sortedDays.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm text-[#9aa3b8]">
            No attendance recorded for this week yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
            {sortedDays.map((day) => (
              <li
                key={day.shiftDate}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-white/[0.03] px-3 py-2.5 sm:flex-nowrap"
              >
                <div className="min-w-[6.5rem] shrink-0">
                  <p className="text-sm font-medium text-white">{formatShiftDayLabel(day.shiftDate)}</p>
                  <p className="font-mono text-[10px] text-[#9aa3b8]">{day.shiftDate}</p>
                </div>
                <Badge
                  variant={attendanceStatusBadgeVariant(day.status)}
                  className="capitalize"
                >
                  {formatAttendanceStatus(day.status)}
                </Badge>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#d7dceb]">
                  <span>
                    In{" "}
                    <span className="font-medium text-white">{formatCheckTime(day.checkInAt)}</span>
                  </span>
                  <span>
                    Out{" "}
                    <span className="font-medium text-white">{formatCheckTime(day.checkOutAt)}</span>
                  </span>
                  {day.isLate ? <span className="text-amber-200">Late</span> : null}
                  {day.isEarlyLeave ? <span className="text-amber-200">Early</span> : null}
                  {day.lateFinePkr > 0 ? (
                    <span className="tabular-nums text-amber-100">
                      {formatLateFinePkr(day.lateFinePkr)}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-[#9aa3b8]">
          Showing this week only. Open{" "}
          <Link href="/attendance/history" className="font-medium text-[#ffb27a] hover:text-white">
            Attendance history
          </Link>{" "}
          for the full record.
        </p>
      </div>
    </section>
  );
}
