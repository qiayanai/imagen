"use client";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { useLocale } from "@/lib/i18n";
import { type LegalPageKey, siteCopy } from "@/lib/site/content";

export function LegalPage({
  pageKey,
}: {
  pageKey: LegalPageKey;
}) {
  const [locale] = useLocale();
  const legal = siteCopy[locale].legal;
  const page = legal[pageKey];

  return (
    <main className="min-h-screen bg-surface-950 text-surface-200">
      <SiteNav />
      <section className="px-5 pb-16 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-mint-400">{legal.lastUpdated}</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-normal text-white sm:text-5xl">{page.title}</h1>
          <p className="mt-5 text-lg leading-8 text-surface-400">{page.intro}</p>
          <div className="mt-10 space-y-8">
            {page.sections.map((section) => (
              <section key={section.title} className="rounded-lg border border-white/10 bg-surface-900/70 p-6 shadow-xl shadow-black/15">
                <h2 className="text-xl font-bold text-white">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-surface-400">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
