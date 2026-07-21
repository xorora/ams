"use client";

import { Clock3 } from "lucide-react";

type EmployeeClockCardProps = {
  pktClock: string;
  shiftDate: string;
};

export function EmployeeClockCard({ pktClock, shiftDate }: EmployeeClockCardProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a1230] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_100%_-10%,#f26b2135,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_0%_100%,#464c9f40,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#464c9f] via-[#f26b21] to-[#464c9f]"
      />

      {/* Decorative arc */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute -right-8 -top-8 size-40 opacity-40 sm:size-48"
        fill="none"
      >
        <circle cx="100" cy="100" r="72" stroke="#f26b21" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 10" />
        <circle cx="100" cy="100" r="56" stroke="#eceef5" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 12" />
        <circle cx="100" cy="100" r="8" fill="#f26b21" fillOpacity="0.8" />
      </svg>

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 md:p-7">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#f26b21]/20 text-[#f26b21]">
            <Clock3 className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#f26b21] uppercase">
              Live clock
            </p>
            <p className="text-sm font-medium text-[#d7dceb]">Pakistan Standard Time · PKT</p>
          </div>
        </div>

        <p className="font-mono text-[2rem] font-semibold leading-none tracking-tight text-white tabular-nums sm:text-4xl md:text-5xl">
          {pktClock || "—:—:—"}
        </p>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-[#eceef5]">
            Shift date
          </span>
          <span className="text-sm font-semibold text-white">{shiftDate}</span>
        </div>
      </div>
    </section>
  );
}
