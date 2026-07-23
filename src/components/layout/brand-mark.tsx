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
    <div className={cn("flex min-w-0 items-center gap-2 overflow-hidden", className)}>
      {/* Compact mark stays fixed; title clips as the rail width animates. */}
      <Image
        src="/xorora-mark.png"
        alt="Xorora"
        width={24}
        height={18}
        sizes="24px"
        className="size-7 shrink-0 object-contain brightness-0 invert"
        priority
      />
      <div className="min-w-0 overflow-hidden whitespace-nowrap">
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
