import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500",
        variant === "secondary" &&
          "border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10",
        variant === "ghost" &&
          "text-surface-200/70 hover:bg-white/5 hover:text-white",
        variant === "danger" &&
          "border border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20",
        className,
      )}
      {...props}
    />
  );
}
