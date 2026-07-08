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
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Image
        src="/xorora-logo.png"
        alt=""
        width={120}
        height={32}
        className="h-7 w-[4.5rem] shrink-0 object-contain object-left group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:object-cover"
        priority
      />
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <p className={cn("truncate font-semibold leading-none tracking-tight", textClassName)}>AMS</p>
        {showSubtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
      </div>
    </div>
  );
}
