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
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black shadow-sm">
        <Image
          src="/xorora-mark.png"
          alt="Xorora"
          width={64}
          height={64}
          className="size-full object-contain"
          priority
        />
      </span>
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <p className={cn("truncate font-semibold leading-none tracking-tight", textClassName)}>AMS</p>
        {showSubtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
      </div>
    </div>
  );
}
