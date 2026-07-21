"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  showHandle,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
  /** Visual drag handle — defaults on for bottom sheets. */
  showHandle?: boolean;
}) {
  const shouldShowHandle = showHandle ?? side === "bottom";

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // `dark` keeps CSS tokens navy when the sheet portals outside the app shell.
          "dark fixed z-50 flex flex-col gap-4 border-white/10 bg-[#0a1230] bg-clip-padding text-sm text-[#eceef5] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.7)] outline-none",
          // Smooth spring-like motion for open/close (shared by all sides).
          "transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
          "data-ending-style:opacity-0 data-starting-style:opacity-0",
          // Bottom — full slide up from off-screen.
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:mt-10 data-[side=bottom]:max-h-[min(94dvh,940px)] data-[side=bottom]:rounded-t-2xl data-[side=bottom]:border-t",
          "data-[side=bottom]:data-ending-style:translate-y-full data-[side=bottom]:data-starting-style:translate-y-full",
          // Top
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:mb-10 data-[side=top]:max-h-[min(94dvh,940px)] data-[side=top]:rounded-b-2xl data-[side=top]:border-b",
          "data-[side=top]:data-ending-style:translate-y-[-100%] data-[side=top]:data-starting-style:translate-y-[-100%]",
          // Left — full drawer slide.
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:sm:max-w-sm",
          "data-[side=left]:data-ending-style:translate-x-[-100%] data-[side=left]:data-starting-style:translate-x-[-100%]",
          // Right — full drawer slide.
          "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:sm:max-w-sm",
          "data-[side=right]:data-ending-style:translate-x-full data-[side=right]:data-starting-style:translate-x-full",
          className,
        )}
        {...props}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-[inherit] bg-gradient-to-r from-[#464c9f] via-[#f26b21] to-[#464c9f]"
        />
        {shouldShowHandle ? (
          <div
            aria-hidden
            className="mx-auto mt-2 mb-0 flex h-1.5 w-12 shrink-0 rounded-full bg-white/25"
          />
        ) : null}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3 size-9 text-[#d7dceb] hover:bg-white/10 hover:text-white"
                size="icon"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 border-b border-white/10 p-4 pr-12", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-2 border-t border-white/10 bg-[#050d22]/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base font-semibold text-white", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm leading-relaxed text-[#d7dceb]", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
