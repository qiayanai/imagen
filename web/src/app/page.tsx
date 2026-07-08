"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  ImageIcon,
  KeyRound,
  Layers3,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PricingCard } from "@/components/site/pricing-card";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { libraryApi } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { pricingPlans, siteCopy } from "@/lib/site/content";
import type { LibraryAsset } from "@/lib/types";

const capabilities = [
  {
    title: "Image generation credits",
    description:
      "Purchase one-time credit packs and use them for product visuals, campaign variants, and social media imagery.",
    icon: Sparkles,
  },
  {
    title: "API key management",
    description:
      "Create separate keys for apps, teams, or environments, then manage quota and concurrency for each key.",
    icon: KeyRound,
  },
  {
    title: "Batch task queue",
    description:
      "Submit single or batch jobs, let the service process them in the background, and poll status until results are ready.",
    icon: Layers3,
  },
  {
    title: "Hosted image results",
    description:
      "Generated images are stored and returned as accessible URLs for CMS, automation workflows, or internal business tools.",
    icon: ImageIcon,
  },
];

export default function Home() {
  const [locale] = useLocale();
  const t = siteCopy[locale].home;
  const [libraryEnabled, setLibraryEnabled] = useState(true);
  const [sampleAssets, setSampleAssets] = useState<LibraryAsset[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadHomeSamples() {
      try {
        const settings = await libraryApi.settings();
        if (!mounted) {
          return;
        }
        setLibraryEnabled(settings.library_public_enabled);
        if (!settings.library_public_enabled) {
          setSampleAssets([]);
          return;
        }
        const featured = await libraryApi.assets({ featured: true, limit: 4 });
        let nextAssets = featured.items;
        if (nextAssets.length < 4) {
          const fallback = await libraryApi.assets({ limit: 4 });
          const seen = new Set(nextAssets.map((asset) => asset.id));
          nextAssets = [
            ...nextAssets,
            ...fallback.items.filter((asset) => !seen.has(asset.id)),
          ].slice(0, 4);
        }
        if (mounted) {
          setSampleAssets(nextAssets);
        }
      } catch {
        if (mounted) {
          setLibraryEnabled(true);
        }
      }
    }

    void loadHomeSamples();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen text-surface-200">
      <section className="relative min-h-[78svh] overflow-hidden border-b border-white/8">
        {sampleAssets[0] ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sampleAssets[0].public_url}
              alt={sampleAssets[0].title || sampleAssets[0].category || "Homepage sample"}
              className="absolute inset-0 h-full w-full object-cover object-[68%_50%] opacity-45"
            />
          </>
        ) : null}
        <div className="absolute inset-0 bg-surface-950/78" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-950 to-transparent" />

        <div className="relative z-10">
          <SiteNav />
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-14 sm:px-6 sm:pt-24 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-surface-300">
                <Sparkles className="h-4 w-4 text-brand-300" aria-hidden="true" />
                {t.badge}
              </p>
              <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.03] tracking-normal text-white sm:text-6xl lg:text-7xl">
                {t.title}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-surface-300 sm:text-xl">{t.intro}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/pricing/"
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
                >
                  {t.viewPricing}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                {libraryEnabled ? (
                  <Link
                    href="/library/"
                    className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    {t.browseLibrary}
                    <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
                <Link
                  href="/client/"
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  {t.openConsole}
                  <TerminalSquare className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-8 grid gap-3 text-sm text-surface-300 sm:grid-cols-3">
                {t.trust.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-mint-400" aria-hidden="true" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="self-end rounded-lg border border-white/10 bg-surface-900/75 p-4 shadow-2xl shadow-black/30 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-surface-500">{t.sampleLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {sampleAssets[0]?.requested_size || t.sampleMeta}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-mint-400/20 bg-mint-400/10 px-2.5 py-1 text-xs font-semibold text-mint-400">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.queuedApi}
                </span>
              </div>
              {sampleAssets.length ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {sampleAssets.map((asset) => (
                    <a
                      key={asset.id}
                      href={asset.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative block aspect-square overflow-hidden rounded-lg bg-surface-950"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.public_url}
                        alt={asset.title || asset.category || "Homepage sample"}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                      {asset.featured ? (
                        <span className="absolute left-2 top-2 rounded-md bg-surface-950/75 px-2 py-1 text-[10px] font-semibold text-mint-300">
                          {locale === "zh" ? "首页" : "Featured"}
                        </span>
                      ) : null}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/10 bg-surface-950 text-sm text-surface-500">
                  {libraryEnabled ? "正在加载素材库样图" : "素材库暂未开放"}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-surface-950 px-5 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-300">{t.capabilitiesEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t.capabilitiesTitle}
            </h2>
            <p className="mt-4 text-base leading-7 text-surface-400">{t.capabilitiesBody}</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {t.capabilities.map((item, index) => {
              const Icon = capabilities[index]?.icon || Sparkles;
              return (
                <article key={item.title} className="rounded-lg border border-white/8 bg-surface-900/60 p-5 shadow-sm shadow-black/20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-surface-400">{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-surface-900/45 px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-brand-300">{t.pricingEyebrow}</p>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                {t.pricingTitle}
              </h2>
              <p className="mt-4 text-base leading-7 text-surface-400">{t.pricingBody}</p>
            </div>
            <Link href="/pricing/" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500">
              {t.comparePlans}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/8 bg-surface-950 px-5 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <p className="text-sm font-semibold text-mint-400">{t.responsibleEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{t.responsibleTitle}</h2>
            <p className="mt-4 text-base leading-7 text-[#d0d5dd]">{t.responsibleBody}</p>
            <Link
              href="/content-policy/"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-surface-950 hover:bg-surface-100"
            >
              {t.readPolicy}
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-3">
            {t.prohibited.map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm leading-6 text-surface-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-950 px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold text-brand-300">{t.apiEyebrow}</p>
            <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              {t.apiTitle}
            </h2>
            <p className="mt-4 text-base leading-7 text-surface-400">{t.apiBody}</p>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-surface-900/70 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f97066]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#fdb022]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#32d583]" />
              <span className="ml-2 text-xs font-medium text-surface-400">POST /v1/tasks</span>
            </div>
            <pre className="overflow-x-auto p-5 text-sm leading-7 text-surface-200">
              <code>{`curl -s https://api.example.com/v1/tasks \\
  -H "Authorization: Bearer sk_img_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "${t.examplePrompt}",
    "image_count": 1,
    "size": "1024x1024",
    "quality": "high",
    "output_format": "png"
  }'`}</code>
            </pre>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
