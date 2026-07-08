"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { libraryApi } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { siteConfig, siteCopy } from "@/lib/site/content";

export function SiteFooter() {
  const [locale] = useLocale();
  const t = siteCopy[locale].footer;
  const [libraryEnabled, setLibraryEnabled] = useState(true);

  useEffect(() => {
    let mounted = true;
    libraryApi.settings()
      .then((settings) => {
        if (mounted) {
          setLibraryEnabled(settings.library_public_enabled);
        }
      })
      .catch(() => {
        if (mounted) {
          setLibraryEnabled(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const footerLinks = [
    libraryEnabled ? { href: "/library/", label: t.links.library } : null,
    { href: "/pricing/", label: t.links.pricing },
    { href: "/docs/", label: t.links.docs },
    { href: "/terms/", label: t.links.terms },
    { href: "/privacy/", label: t.links.privacy },
    { href: "/refund/", label: t.links.refund },
    { href: "/content-policy/", label: t.links.contentPolicy },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <footer className="border-t border-white/8 bg-surface-950 px-5 py-10 text-surface-400 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <div className="text-sm font-semibold text-white">{siteConfig.name}</div>
          <p className="mt-2 max-w-2xl text-sm leading-6">{t.body}</p>
          <p className="mt-3 text-sm">
            {t.contact}:{" "}
            <a className="font-medium text-white hover:underline" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-surface-400 hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
