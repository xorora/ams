"use client";

import { format, parse } from "date-fns";
import { CalendarIcon, Clock2Icon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

function parsePktLocal(value: string): { date?: Date; time: string } {
  if (!value.trim()) {
    return { time: "" };
  }
  const parsed = parse(value, DATETIME_FORMAT, new Date());
  if (Number.isNaN(parsed.getTime())) {
    return { time: "" };
  }
  return {
    date: parsed,
    time: format(parsed, "HH:mm"),
  };
}

function formatPktLocal(date: Date, time: string): string {
  const [hours = "0", minutes = "0"] = time.split(":");
  const combined = new Date(date);
  combined.setHours(Number(hours), Number(minutes), 0, 0);
  return format(combined, DATETIME_FORMAT);
}

function formatDisplay(value: string): string | null {
  const { date } = parsePktLocal(value);
  if (!date) {
    return null;
  }
  return format(date, "MMM d, yyyy 'at' HH:mm");
}

type DateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  timeLabel?: string;
};

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date and time",
  disabled,
  className,
  timeLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const timeInputId = React.useId();
  const { date: selectedDate, time } = parsePktLocal(value);
  const displayValue = formatDisplay(value);

  const updateDate = (date: Date) => {
    onChange(formatPktLocal(date, time || "00:00"));
  };

  const updateTime = (nextTime: string) => {
    if (!selectedDate) {
      if (!nextTime) {
        onChange("");
        return;
      }
      onChange(formatPktLocal(new Date(), nextTime));
      return;
    }
    onChange(formatPktLocal(selectedDate, nextTime));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-8 w-full justify-start px-2.5 font-normal",
              !displayValue && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        {displayValue ?? placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          onSelect={(date) => {
            if (!date) {
              return;
            }
            updateDate(date);
          }}
          className="p-0"
        />
        <div className="border-t bg-card p-3">
          <div className="flex flex-col gap-1.5">
            {timeLabel ? <Label htmlFor={timeInputId}>{timeLabel}</Label> : null}
            <div className="relative">
              <Input
                id={timeInputId}
                type="time"
                disabled={disabled}
                value={time}
                onChange={(e) => updateTime(e.target.value)}
                aria-label={timeLabel ?? "Time"}
                className="bg-background pr-9 appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              />
              <Clock2Icon
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { formatPktLocal, parsePktLocal };
