"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";

import type { PricingPlan } from "@/lib/site/content";
import { useLocale } from "@/lib/i18n";
import { siteCopy } from "@/lib/site/content";
import { cn } from "@/lib/utils";

export function PricingCard({ plan }: { plan: PricingPlan }) {
  const [locale] = useLocale();
  const copy = siteCopy[locale];
  const planCopy = copy.pricingPlans[plan.id];
  const external = plan.checkoutUrl.startsWith("http");

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-lg border bg-surface-900/60 p-5 shadow-sm shadow-black/20",
        plan.featured ? "border-brand-400/40 shadow-lg shadow-brand-600/10" : "border-white/8",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">{planCopy.name}</h3>
          <p className="mt-2 text-sm leading-6 text-surface-400">{planCopy.description}</p>
        </div>
        {plan.featured ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-mint-400/20 bg-mint-400/10 px-2 py-1 text-xs font-semibold text-mint-400">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {copy.pricingCard.popular}
          </span>
        ) : null}
      </div>
      <div className="mt-6">
        <div className="text-4xl font-extrabold tracking-normal text-white">{plan.price}</div>
        <div className="mt-1 text-sm font-semibold text-surface-400">{planCopy.credits}</div>
      </div>
      <ul className="mt-6 grid gap-3">
        {planCopy.highlights.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-surface-300">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint-400" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={plan.checkoutUrl}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={cn(
          "mt-7 inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition",
          plan.featured
            ? "bg-brand-600 text-white hover:bg-brand-500"
            : "border border-white/10 bg-white/5 text-white hover:bg-white/10",
        )}
      >
        {copy.pricingCard.buy}
      </Link>
    </article>
  );
}
