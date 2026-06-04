"use client";

import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DATE_FORMAT = "yyyy-MM-dd";

function parseShiftDate(value: string): Date | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = parse(value, DATE_FORMAT, new Date());
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}

function formatShiftDate(date: Date): string {
  return format(date, DATE_FORMAT);
}

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
};

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseShiftDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-invalid={ariaInvalid}
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-8 w-full justify-start px-2.5 font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        {selected ? format(selected, "MMM d, yyyy") : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) {
              return;
            }
            onChange(formatShiftDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export { formatShiftDate, parseShiftDate };
