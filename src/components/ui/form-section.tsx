import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared panel chrome for form sections inside navy sheets/pages. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-white/12 bg-[#050d22]/70 p-4",
        className,
      )}
    >
      {title || description ? (
        <div className="space-y-1">
          {title ? <p className="text-sm font-semibold text-white">{title}</p> : null}
          {description ? (
            <p className="text-sm leading-relaxed text-[#d7dceb]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Consistent field stack spacing for admin forms. */
export function FormField({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-1.5", className)}>{children}</div>;
}
