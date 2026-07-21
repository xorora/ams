import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import Link from "next/link";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type EmployeeDashboardWeekAttendanceProps = {
  days: SerializedEmployeeReport["days"];
  range: { from: string; to: string };
  summary: SerializedEmployeeReport["summary"] | null;
};

type DayKind = "ontime" | "late" | "neutral";

type WeekPoint = {
  shiftDate: string;
  label: string;
  value: 1 | 0 | -1;
  kind: DayKind;
};

const COLOR_ONTIME = "#34d399";
const COLOR_LATE = "#f87171";
const COLOR_NEUTRAL = "#6b70b6";

function eachDateInclusive(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = fromZonedTime(`${from} 12:00:00`, BUSINESS_TIMEZONE);
  const end = fromZonedTime(`${to} 12:00:00`, BUSINESS_TIMEZONE);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatInTimeZone(cursor, BUSINESS_TIMEZONE, "yyyy-MM-dd"));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function buildWeekSeries(
  days: SerializedEmployeeReport["days"],
  range: { from: string; to: string },
): WeekPoint[] {
  const byDate = new Map(days.map((day) => [day.shiftDate, day]));

  return eachDateInclusive(range.from, range.to).map((shiftDate) => {
    const noon = fromZonedTime(`${shiftDate} 12:00:00`, BUSINESS_TIMEZONE);
    const label = formatInTimeZone(noon, BUSINESS_TIMEZONE, "EEE");
    const day = byDate.get(shiftDate);

    if (day?.isLate) {
      return { shiftDate, label, value: -1, kind: "late" };
    }
    if (day?.status === "present" && !day.isLate) {
      return { shiftDate, label, value: 1, kind: "ontime" };
    }
    return { shiftDate, label, value: 0, kind: "neutral" };
  });
}

function kindColor(kind: DayKind): string {
  switch (kind) {
    case "ontime":
      return COLOR_ONTIME;
    case "late":
      return COLOR_LATE;
    default:
      return COLOR_NEUTRAL;
  }
}

type WeekAttendanceChartProps = {
  points: WeekPoint[];
  ariaLabel: string;
};

function WeekAttendanceChart({ points, ariaLabel }: WeekAttendanceChartProps) {
  const width = 560;
  const height = 152;
  const padX = 28;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;
  const midY = padTop + plotH / 2;
  const amp = plotH * 0.38;
  const n = Math.max(points.length, 1);

  const coords = points.map((point, index) => {
    const x = padX + (n === 1 ? plotW / 2 : (index / (n - 1)) * plotW);
    const y = midY - point.value * amp;
    return { ...point, x, y };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[9.5rem] w-full"
      role="img"
      aria-label={ariaLabel}
    >
      {/* Baseline */}
      <line
        x1={padX}
        y1={midY}
        x2={width - padX}
        y2={midY}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        strokeDasharray="4 6"
      />
      <text
        x={8}
        y={midY - amp + 4}
        className="fill-[#9aa3b8]"
        fontSize={9}
        fontFamily="ui-monospace, monospace"
      >
        On time
      </text>
      <text
        x={8}
        y={midY + amp + 3}
        className="fill-[#9aa3b8]"
        fontSize={9}
        fontFamily="ui-monospace, monospace"
      >
        Late
      </text>

      {/* Segments colored by destination point */}
      {coords.slice(1).map((point, index) => {
        const prev = coords[index];
        return (
          <line
            key={`${prev.shiftDate}-${point.shiftDate}`}
            x1={prev.x}
            y1={prev.y}
            x2={point.x}
            y2={point.y}
            stroke={kindColor(point.kind)}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={point.kind === "neutral" && prev.kind === "neutral" ? 0.55 : 0.95}
          />
        );
      })}

      {/* Points */}
      {coords.map((point) => (
        <g key={point.shiftDate}>
          <circle
            cx={point.x}
            cy={point.y}
            r={point.kind === "neutral" ? 3.5 : 5}
            fill={kindColor(point.kind)}
            stroke="#0a1230"
            strokeWidth={2}
          />
          <text
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-[#c8cce0]"
            fontSize={11}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function EmployeeDashboardWeekAttendance({
  days,
  range,
  summary,
}: EmployeeDashboardWeekAttendanceProps) {
  const points = buildWeekSeries(days, range);
  const ontimeCount = points.filter((p) => p.kind === "ontime").length;
  const lateCount = points.filter((p) => p.kind === "late").length;
  const hasSignal = days.length > 0 || ontimeCount > 0 || lateCount > 0;
  const ariaLabel = `This week attendance: ${ontimeCount} on time, ${lateCount} late.`;

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

        {!hasSignal ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-center text-sm text-[#9aa3b8]">
            No attendance recorded for this week yet.
          </p>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2 sm:px-3">
            <WeekAttendanceChart points={points} ariaLabel={ariaLabel} />
            <div className="mt-1 flex flex-wrap items-center justify-center gap-4 pb-1 text-[11px] text-[#c8cce0]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#34d399]" aria-hidden />
                On time
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#f87171]" aria-hidden />
                Late (down)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#6b70b6]" aria-hidden />
                Other / off
              </span>
            </div>
          </div>
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
