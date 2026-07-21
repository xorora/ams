"use client";

import { Clock3 } from "lucide-react";

type EmployeeClockCardProps = {
  pktClock: string;
  shiftDate: string;
};

export function EmployeeClockCard({ pktClock, shiftDate }: EmployeeClockCardProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_100%_-10%,#f26b2130,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#464c9f] via-[#f26b21] to-[#464c9f]"
      />

      <div className="relative flex h-full flex-col justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#f26b21]/20 text-[#f26b21]">
            <Clock3 className="size-4" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              Live clock
            </p>
            <p className="text-xs font-medium text-[#d7dceb]">PKT</p>
          </div>
        </div>

        <p className="font-mono text-[1.75rem] font-semibold leading-none tracking-tight text-white tabular-nums sm:text-3xl">
          {pktClock || "—:—:—"}
        </p>

        <p className="text-xs text-[#c8cce0]">
          Shift date <span className="font-semibold text-white">{shiftDate}</span>
        </p>
      </div>
    </section>
  );
}
