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
  subtitle = "Attendance Management",
}: BrandMarkProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {/* Full wordmark: shown when the sidebar is expanded (and everywhere off-sidebar). */}
      <Image
        src="/xorora-full.png"
        alt="Xorora"
        width={1024}
        height={198}
        className="h-6 w-auto shrink-0 object-contain group-data-[collapsible=icon]:hidden"
        priority
      />
      {/* X mark only: shown when the sidebar is collapsed to icons. */}
      <Image
        src="/xorora-mark.png"
        alt="Xorora"
        width={354}
        height={268}
        className="hidden size-6 shrink-0 object-contain group-data-[collapsible=icon]:block"
        priority
      />
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <p className={cn("truncate font-semibold leading-none tracking-tight", textClassName)}>AMS</p>
        {showSubtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
      </div>
    </div>
  );
}
