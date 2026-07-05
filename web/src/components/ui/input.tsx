import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none transition placeholder:text-surface-400 focus:border-brand-400/70 focus:ring-2 focus:ring-brand-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-lg border border-white/10 bg-surface-950/70 px-3 py-2 text-sm text-white outline-none transition placeholder:text-surface-400 focus:border-brand-400/70 focus:ring-2 focus:ring-brand-500/20",
        className,
      )}
      {...props}
    />
  );
}
