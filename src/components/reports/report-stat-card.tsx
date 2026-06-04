"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ReportStatCardProps = {
  label: string;
  value: number;
};

export function ReportStatCard({ label, value }: ReportStatCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="-mt-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
