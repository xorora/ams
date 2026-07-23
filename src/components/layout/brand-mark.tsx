import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  textClassName?: string;
  showSubtitle?: boolean;
  subtitle?: string;
};

/** Same lockup as the landing header: inverted Xorora wordmark + Punch; X mark when collapsed. */
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
        "group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center",
        className,
      )}
    >
      <Image
        src="/xorora-full.png"
        alt="Xorora"
        width={320}
        height={62}
        sizes="140px"
        className="h-5 w-auto max-w-[7.5rem] shrink-0 object-contain object-left brightness-0 invert group-data-[collapsible=icon]:hidden"
        priority
      />
      <Image
        src="/xorora-mark.png"
        alt="Xorora"
        width={354}
        height={268}
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
