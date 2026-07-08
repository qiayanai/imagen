"use client";

import { Languages } from "lucide-react";

import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type LanguageToggleProps = {
  locale: Locale;
  onChange: (locale: Locale) => void;
  tone?: "light" | "dark";
};

export function LanguageToggle({ locale, onChange, tone = "dark" }: LanguageToggleProps) {
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "zh", label: "中文" },
  ];

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-lg border p-1",
        tone === "light" ? "border-black/10 bg-white/72" : "border-white/10 bg-white/5",
      )}
      aria-label="Language"
    >
      <Languages
        className={cn("ml-1.5 h-4 w-4", tone === "light" ? "text-[#667085]" : "text-surface-400")}
        aria-hidden="true"
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 rounded-md px-2 text-xs font-semibold transition",
            locale === option.value
              ? tone === "light"
                ? "bg-[#101828] text-white"
                : "bg-white text-surface-950"
              : tone === "light"
                ? "text-[#475467] hover:bg-black/5"
                : "text-surface-300 hover:bg-white/10 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
