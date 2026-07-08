"use client";

import { ArrowRight, Copy, ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { libraryApi } from "@/lib/api";
import { useLocale, type Locale } from "@/lib/i18n";
import { libraryPromptStorageKey } from "@/lib/library";
import type { LibraryAsset, LibraryCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const libraryPageSize = 36;

type LibraryCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  search: string;
  searchAction: string;
  allCategories: string;
  loading: string;
  empty: string;
  disabled: string;
  disabledBody: string;
  loadMore: string;
  copyPrompt: string;
  copied: string;
  useInConsole: string;
  viewImage: string;
  prompt: string;
  results: string;
};

const copy: Record<Locale, LibraryCopy> = {
  en: {
    eyebrow: "Asset library",
    title: "Browse reusable prompts and generated references.",
    intro:
      "Explore curated generated images, inspect the prompts behind them, and send a useful prompt into your own customer console.",
    search: "Search prompts, tags, or categories",
    searchAction: "Search",
    allCategories: "All categories",
    loading: "Loading library assets",
    empty: "No matching assets yet",
    disabled: "Asset library is closed",
    disabledBody: "The administrator has temporarily closed the public asset library.",
    loadMore: "Load more",
    copyPrompt: "Copy prompt",
    copied: "Copied",
    useInConsole: "Use in console",
    viewImage: "View image",
    prompt: "Prompt",
    results: "assets",
  },
  zh: {
    eyebrow: "素材库",
    title: "浏览可复用的提示词和生成参考图。",
    intro: "这里展示已经筛过的生成素材。你可以查看图片、复制 prompt，或者把 prompt 带到自己的客户控制台继续生成。",
    search: "搜索提示词、标签或分类",
    searchAction: "搜索",
    allCategories: "全部分类",
    loading: "正在加载素材",
    empty: "没有匹配的素材",
    disabled: "素材库暂未开放",
    disabledBody: "管理员已经临时关闭公开素材库。",
    loadMore: "加载更多",
    copyPrompt: "复制提示词",
    copied: "已复制",
    useInConsole: "去控制台使用",
    viewImage: "查看图片",
    prompt: "提示词",
    results: "个素材",
  },
};

export function LibraryBrowser() {
  const [locale] = useLocale();
  const t = copy[locale];
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const [libraryEnabled, setLibraryEnabled] = useState(true);
  const [copiedID, setCopiedID] = useState("");

  const loadPage = useCallback(async (nextPage = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setMessage("");
    try {
      const settings = await libraryApi.settings();
      setLibraryEnabled(settings.library_public_enabled);
      if (!settings.library_public_enabled) {
        setAssets([]);
        setTotal(0);
        setCategories([]);
        return;
      }
      const [assetResult, categoryResult] = await Promise.all([
        libraryApi.assets({ category, q: query, page: nextPage, limit: libraryPageSize }),
        libraryApi.categories(),
      ]);
      setAssets((current) => append ? [...current, ...assetResult.items] : assetResult.items);
      setTotal(assetResult.total);
      setPage(nextPage);
      setCategories(categoryResult.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.empty);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, query, t.empty]);

  useEffect(() => {
    void loadPage(1, false);
  }, [loadPage]);

  const featuredAssets = useMemo(() => assets.slice(0, 3), [assets]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = draftQuery.trim();
    setQuery(nextQuery);
    if (nextQuery === query) {
      void loadPage(1, false);
    }
  }

  async function copyPrompt(asset: LibraryAsset) {
    const prompt = asset.normalized_prompt || asset.original_prompt;
    await navigator.clipboard.writeText(prompt);
    setCopiedID(asset.id);
  }

  function sendToConsole(asset: LibraryAsset) {
    const prompt = asset.normalized_prompt || asset.original_prompt;
    window.localStorage.setItem(libraryPromptStorageKey, prompt);
    window.location.href = "/client/";
  }

  return (
    <main className="min-h-screen bg-surface-950 text-surface-200">
      <section className="px-5 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 pt-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-mint-400">{t.eyebrow}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-normal text-white sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-surface-400 sm:text-lg">{t.intro}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {featuredAssets.map((asset) => (
              <a
                key={asset.id}
                href={asset.public_url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-lg border border-white/10 bg-surface-900/70 shadow-xl shadow-black/20"
              >
                <div className="aspect-[4/5] bg-surface-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.public_url}
                    alt={asset.title || asset.category || "Library asset"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-surface-900/60 px-5 py-5 sm:px-6 lg:px-8">
        <form className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]" onSubmit={submitSearch}>
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" aria-hidden="true" />
            <Input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder={t.search}
              className="border-white/10 bg-surface-950/70 pl-9 text-white placeholder:text-surface-500 focus:border-brand-400/60 focus:ring-brand-500/10"
            />
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none"
          >
            <option value="">{t.allCategories}</option>
            {categories.map((item) => (
              <option key={item.category || "uncategorized"} value={item.category}>
                {item.category || "Uncategorized"} ({item.count})
              </option>
            ))}
          </select>
          <Button type="submit" className="bg-brand-600 hover:bg-brand-500">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t.searchAction}
          </Button>
        </form>
      </section>

      <section className="px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="text-sm text-surface-400">
              {total} {t.results}
            </div>
            <Link href="/client/" className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-mint-400">
              {t.useInConsole}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {message ? (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{message}</div>
          ) : null}

          {loading && !assets.length ? (
            <div className="flex min-h-80 items-center justify-center rounded-lg border border-white/10 bg-surface-900/60 text-surface-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="ml-2 text-sm">{t.loading}</span>
            </div>
          ) : assets.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => (
                  <article key={asset.id} className="overflow-hidden rounded-lg border border-white/10 bg-surface-900/70 shadow-xl shadow-black/15">
                  <a href={asset.public_url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-surface-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.public_url}
                      alt={asset.title || asset.category || "Library asset"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-mint-400/10 px-2.5 py-1 text-xs font-semibold text-mint-400">
                        {asset.category || "Uncategorized"}
                      </span>
                      {asset.review_score ? <span className="text-xs text-surface-500">{asset.review_score.toFixed(2)}</span> : null}
                    </div>
                    <h2 className="mt-3 line-clamp-2 min-h-10 text-base font-bold text-white">
                      {asset.title || asset.legacy_asset_id}
                    </h2>
                    <p className="mt-3 line-clamp-4 min-h-24 text-sm leading-6 text-surface-400">
                      {asset.normalized_prompt || asset.original_prompt}
                    </p>
                    {asset.tags.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {asset.tags.slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded-md border border-white/8 bg-white/5 px-2 py-1 text-[11px] text-surface-400">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void copyPrompt(asset)}
                        className={cn(
                          "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm font-semibold transition",
                          copiedID === asset.id ? "bg-mint-400/10 text-mint-400" : "bg-white/5 text-white hover:bg-white/10",
                        )}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        {copiedID === asset.id ? t.copied : t.copyPrompt}
                      </button>
                      <button
                        type="button"
                        onClick={() => sendToConsole(asset)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-500"
                      >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        {t.useInConsole}
                      </button>
                    </div>
                    <a
                      href={asset.public_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-surface-500 hover:text-white"
                    >
                      {t.viewImage}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </div>
                  </article>
                ))}
              </div>
              {assets.length < total ? (
                <div className="mt-8 flex justify-center">
                  <Button
                    type="button"
                    onClick={() => void loadPage(page + 1, true)}
                    className="bg-brand-600 hover:bg-brand-500"
                    disabled={loadingMore}
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {t.loadMore}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-white/15 bg-surface-900/55 text-sm text-surface-400">
              {libraryEnabled ? t.empty : (
                <div className="text-center">
                  <div className="font-semibold text-white">{t.disabled}</div>
                  <div className="mt-2 text-surface-400">{t.disabledBody}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
