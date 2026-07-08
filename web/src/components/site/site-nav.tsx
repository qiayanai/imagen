"use client";

import { ImageIcon, LockKeyhole, TerminalSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { libraryApi } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { siteCopy } from "@/lib/site/content";

export function SiteNav() {
  const [locale, setLocale] = useLocale();
  const t = siteCopy[locale].nav;
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

  return (
    <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-6 lg:px-8">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        Imagen
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <LanguageToggle locale={locale} onChange={setLocale} />
        {libraryEnabled ? (
          <Link
            href="/library/"
            className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-surface-300 hover:bg-white/5 hover:text-white"
          >
            {t.library}
          </Link>
        ) : null}
        <Link
          href="/pricing/"
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-surface-300 hover:bg-white/5 hover:text-white"
        >
          {t.pricing}
        </Link>
        <Link
          href="/docs/"
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-surface-300 hover:bg-white/5 hover:text-white"
        >
          {t.docs}
        </Link>
        <Link
          href="/client/"
          className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-surface-300 hover:bg-white/5 hover:text-white"
        >
          <TerminalSquare className="h-4 w-4" aria-hidden="true" />
          {t.console}
        </Link>
        <Link
          href="/admin/"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-500"
        >
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          {t.admin}
        </Link>
      </div>
    </nav>
  );
}
