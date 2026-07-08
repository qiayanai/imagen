"use client";

import { ShieldCheck } from "lucide-react";

import { PricingCard } from "@/components/site/pricing-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { useLocale } from "@/lib/i18n";
import { pricingPlans, siteCopy } from "@/lib/site/content";

export default function PricingPage() {
  const [locale] = useLocale();
  const t = siteCopy[locale].pricingPage;

  return (
    <main className="min-h-screen bg-surface-950 text-surface-200">
      <SiteNav />
      <section className="px-5 pb-16 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-mint-400">{t.eyebrow}</p>
            <h1 className="mt-3 text-5xl font-extrabold leading-tight tracking-normal text-white sm:text-6xl">
              {t.title}
            </h1>
            <p className="mt-5 text-lg leading-8 text-surface-400">{t.intro}</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {t.notes.map((item) => (
              <article key={item.title} className="rounded-lg border border-white/10 bg-surface-900/70 p-5 shadow-xl shadow-black/15">
                <ShieldCheck className="h-5 w-5 text-mint-400" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-bold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-surface-400">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
