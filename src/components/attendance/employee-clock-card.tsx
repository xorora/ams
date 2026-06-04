"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EmployeeClockCardProps = {
  pktClock: string;
  shiftDate: string;
};

export function EmployeeClockCard({ pktClock, shiftDate }: EmployeeClockCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Pakistan Standard Time
        </CardTitle>
      </CardHeader>
      <CardContent className="-mt-2">
        <p className="font-mono text-2xl font-semibold tabular-nums">{pktClock}</p>
        <p className="mt-2 text-muted-foreground text-sm">
          Shift date: <span className="font-medium text-foreground">{shiftDate}</span>
        </p>
      </CardContent>
    </Card>
  );
}
