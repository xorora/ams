"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EmployeeClockCardProps = {
  pktClock: string;
  shiftDate: string;
};

export function EmployeeClockCard({ pktClock, shiftDate }: EmployeeClockCardProps) {
  return (
    <Card className="relative overflow-hidden border-white/10 bg-[#0a1230]/90 ring-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_0%,#f26b2122,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f26b21]/70 to-transparent"
      />
      <CardHeader className="relative">
        <CardTitle className="font-mono text-[11px] font-medium tracking-[0.18em] text-[#a8aec4] uppercase">
          Pakistan Standard Time
        </CardTitle>
      </CardHeader>
      <CardContent className="relative -mt-2">
        <p className="bg-gradient-to-r from-white via-[#eceef5] to-[#f4a574] bg-clip-text font-mono text-3xl font-semibold tabular-nums text-transparent md:text-4xl">
          {pktClock || "—"}
        </p>
        <p className="mt-3 text-[#a8aec4] text-sm">
          Shift date: <span className="font-medium text-[#eceef5]">{shiftDate}</span>
        </p>
      </CardContent>
    </Card>
  );
}
