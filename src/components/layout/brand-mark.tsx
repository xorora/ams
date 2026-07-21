import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  textClassName?: string;
  showSubtitle?: boolean;
  subtitle?: string;
};

export function BrandMark({
  className,
  textClassName,
  showSubtitle = false,
  subtitle = "Attendance",
}: BrandMarkProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {/* Full wordmark: shown when the sidebar is expanded (and everywhere off-sidebar). */}
      <Image
        src="/xorora-full.png"
        alt="Xorora"
        width={160}
        height={31}
        sizes="160px"
        className="h-4 w-auto shrink-0 object-contain brightness-0 invert group-data-[collapsible=icon]:hidden"
        priority
      />
      {/* X mark only: shown when the sidebar is collapsed to icons — lazy, not LCP. */}
      <Image
        src="/xorora-mark.png"
        alt="Xorora"
        width={24}
        height={18}
        sizes="24px"
        className="hidden size-6 shrink-0 object-contain brightness-0 invert group-data-[collapsible=icon]:block"
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
