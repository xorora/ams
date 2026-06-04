import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type FeedbackBannerProps = {
  type: "success" | "error";
  text: string;
  className?: string;
};

export function FeedbackBanner({ type, text, className }: FeedbackBannerProps) {
  return (
    <Alert
      variant={type === "error" ? "destructive" : "default"}
      className={cn(
        type === "success" &&
          "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100",
        className,
      )}
    >
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
