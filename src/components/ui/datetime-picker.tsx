"use client";

import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PKT_DATETIME_LONG_12H_FORMAT } from "@/lib/admin/display";
import { cn } from "@/lib/utils";

const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const MERIDIEM_OPTIONS = ["AM", "PM"] as const;

type Meridiem = (typeof MERIDIEM_OPTIONS)[number];

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

function time24ToParts(time24: string): { hour: string; minute: string; meridiem: Meridiem } {
  if (!time24) {
    return { hour: "12", minute: "00", meridiem: "AM" };
  }

  const [hourRaw = "0", minuteRaw = "00"] = time24.split(":");
  let hour = Number(hourRaw);
  const minute = minuteRaw.padStart(2, "0");
  const meridiem: Meridiem = hour >= 12 ? "PM" : "AM";

  if (hour === 0) {
    hour = 12;
  } else if (hour > 12) {
    hour -= 12;
  }

  return { hour: String(hour), minute, meridiem };
}

function partsToTime24(hour: string, minute: string, meridiem: Meridiem): string {
  let hour24 = Number(hour);

  if (meridiem === "AM") {
    if (hour24 === 12) {
      hour24 = 0;
    }
  } else if (hour24 !== 12) {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function formatDisplay(value: string): string | null {
  const { date } = parsePktLocal(value);
  if (!date) {
    return null;
  }
  return format(date, PKT_DATETIME_LONG_12H_FORMAT);
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
  const { hour, minute, meridiem } = time24ToParts(time);

  const updateDate = (date: Date) => {
    onChange(formatPktLocal(date, time || "00:00"));
  };

  const updateTimeParts = (nextHour: string, nextMinute: string, nextMeridiem: Meridiem) => {
    const nextTime = partsToTime24(nextHour, nextMinute, nextMeridiem);

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
            <div id={timeInputId} className="grid grid-cols-3 gap-2">
              <Select
                items={Object.fromEntries(HOURS_12.map((item) => [item, item]))}
                value={hour}
                onValueChange={(nextHour) => updateTimeParts(nextHour as string, minute, meridiem)}
                disabled={disabled}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={timeLabel ? `${timeLabel} hour` : "Hour"}
                >
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {HOURS_12.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={Object.fromEntries(MINUTES.map((item) => [item, item]))}
                value={minute}
                onValueChange={(nextMinute) =>
                  updateTimeParts(hour, nextMinute as string, meridiem)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={timeLabel ? `${timeLabel} minute` : "Minute"}
                >
                  <SelectValue placeholder="Min" />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                items={Object.fromEntries(MERIDIEM_OPTIONS.map((item) => [item, item]))}
                value={meridiem}
                onValueChange={(nextMeridiem) =>
                  updateTimeParts(hour, minute, nextMeridiem as Meridiem)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={timeLabel ? `${timeLabel} meridiem` : "AM or PM"}
                >
                  <SelectValue placeholder="AM/PM" />
                </SelectTrigger>
                <SelectContent>
                  {MERIDIEM_OPTIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { formatPktLocal, parsePktLocal };
