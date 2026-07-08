"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Locale = "en" | "zh";

const storageKey = "imagen-locale";
const changeEvent = "imagen-locale-change";
const defaultLocale: Locale = "en";

function normalizeLocale(value: string | null): Locale {
  return value === "zh" ? "zh" : "en";
}

function getLocaleSnapshot(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }
  try {
    return normalizeLocale(window.localStorage.getItem(storageKey));
  } catch {
    return defaultLocale;
  }
}

function subscribeLocale(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener("storage", callback);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changeEvent, callback);
  };
}

export function useLocale() {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => defaultLocale);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // Ignore storage failures; subscribers still update for this page.
    }
    window.dispatchEvent(new Event(changeEvent));
  }, []);

  return [locale, setLocale] as const;
}

export function dateLocale(locale: Locale) {
  return locale === "zh" ? "zh-CN" : "en-US";
}
