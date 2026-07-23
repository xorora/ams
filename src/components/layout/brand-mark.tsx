import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  textClassName?: string;
  showSubtitle?: boolean;
  subtitle?: string;
};

/**
 * Sidebar / chrome brand lockup.
 * Expanded: full white XORORA wordmark (watermark lines intact) + Punch.
 * Collapsed: colored X mark only, sized for the icon rail — no invert filters
 * (those flatten the mark and erase the watermark).
 */
export function BrandMark({
  className,
  textClassName,
  showSubtitle = false,
  subtitle = "Attendance",
}: BrandMarkProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        "group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
        className,
      )}
    >
      <Image
        src="/xorora-logo-white.png"
        alt="Xorora"
        width={180}
        height={60}
        sizes="140px"
        className="h-5 w-auto max-w-[9rem] shrink-0 object-contain object-left group-data-[collapsible=icon]:hidden"
        priority
      />
      <Image
        src="/xorora-mark.png"
        alt="Xorora"
        width={354}
        height={268}
        sizes="28px"
        className="hidden size-7 shrink-0 object-contain group-data-[collapsible=icon]:block"
      />
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <p
          className={cn(
            "truncate font-semibold leading-none tracking-tight text-white",
            textClassName,
          )}
        >
          Punch
        </p>
        {showSubtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
      </div>
    </div>
  );
}
