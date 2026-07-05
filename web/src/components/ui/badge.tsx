import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "border-white/10 bg-white/5 text-surface-200",
        tone === "green" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        tone === "amber" && "border-amber-400/25 bg-amber-400/10 text-amber-200",
        tone === "red" && "border-rose-400/25 bg-rose-400/10 text-rose-200",
        tone === "blue" && "border-sky-400/25 bg-sky-400/10 text-sky-200",
        className,
      )}
      {...props}
    />
  );
}
