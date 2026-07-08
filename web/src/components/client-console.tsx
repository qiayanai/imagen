"use client";

import {
  ArrowUpRight,
  BarChart3,
  Copy,
  Home,
  ImageIcon,
  KeyRound,
  LayoutList,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LanguageToggle } from "@/components/language-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { clientPortalApi, libraryApi } from "@/lib/api";
import { dateLocale, useLocale, type Locale } from "@/lib/i18n";
import { libraryPromptStorageKey } from "@/lib/library";
import type { APIKey, Customer, ImageTask, LibraryAsset, LibraryCategory, Quota } from "@/lib/types";
import { cn } from "@/lib/utils";

const selectedKeyStorageKey = "imagen-client-selected-key";

type ClientView = "tasks" | "library" | "usage" | "keys" | "access";
type ModalType = "task" | "key" | null;

type ClientCopy = {
  eyebrow: string;
  title: string;
  subtitle: string;
  home: string;
  admin: string;
  signOut: string;
  accessTitle: string;
  accessHelp: string;
  invitationTitle: string;
  invitationHelp: string;
  invitationHint: string;
  signInWithGoogle: string;
  googleUnavailable: string;
  serviceUnavailable: string;
  retry: string;
  signedIn: string;
  noSession: string;
  tabs: Record<ClientView, string>;
  tasksTitle: string;
  tasksHelp: string;
  libraryTitle: string;
  libraryHelp: string;
  searchLibrary: string;
  searchAction: string;
  allCategories: string;
  emptyLibrary: string;
  libraryDisabledTitle: string;
  libraryDisabledHelp: string;
  usePrompt: string;
  newTask: string;
  selectedKey: string;
  keySelector: string;
  noKeys: string;
  noKeyHelp: string;
  usageTitle: string;
  usageHelp: string;
  keysTitle: string;
  keysHelp: string;
  createKey: string;
  keyName: string;
  select: string;
  selected: string;
  deleteKey: string;
  deleteKeyConfirm: string;
  deleteKeyFailed: string;
  newKeySecret: string;
  secretShownOnce: string;
  copySecret: string;
  copied: string;
  close: string;
  prompt: string;
  imageCount: string;
  size: string;
  quality: string;
  low: string;
  medium: string;
  high: string;
  createTask: string;
  totalUsed: string;
  dailyUsed: string;
  remaining: string;
  dailyRemaining: string;
  concurrency: string;
  unlimited: string;
  tasksTotal: string;
  tasksActive: string;
  tasksSucceeded: string;
  tasksFailed: string;
  emptyTasks: string;
  status: string;
  promptColumn: string;
  images: string;
  output: string;
  createdAt: string;
  open: string;
  noOutput: string;
  chooseKeyFirst: string;
  loadFailed: string;
  createKeyFailed: string;
  createFailed: string;
  defaultKeyName: string;
  defaultPrompt: string;
  statusLabels: Record<string, string>;
};

const copy: Record<Locale, ClientCopy> = {
  en: {
    eyebrow: "Customer console",
    title: "Image generation dashboard",
    subtitle: "Manage API keys, generated jobs, and quota from one clean workspace.",
    home: "Home",
    admin: "Admin",
    signOut: "Sign out",
    accessTitle: "Dashboard access",
    accessHelp: "Your Google account is your customer account on this browser.",
    invitationTitle: "Sign in with Google",
    invitationHelp: "Use your Google account to manage API keys, generation tasks, and quota.",
    invitationHint: "One Google account maps to one customer workspace. Each workspace can manage many API keys.",
    signInWithGoogle: "Continue with Google",
    googleUnavailable: "Google sign-in is not configured.",
    serviceUnavailable: "The customer API service is not reachable. Please try again after the service is online.",
    retry: "Retry",
    signedIn: "Signed in",
    noSession: "No session",
    tabs: {
      tasks: "Generation tasks",
      library: "Asset library",
      usage: "Usage & quota",
      keys: "API keys",
      access: "Access",
    },
    tasksTitle: "Generation tasks",
    tasksHelp: "Review recent generation jobs for the selected API key.",
    libraryTitle: "Asset library",
    libraryHelp: "Browse proven prompts and reference images, then reuse a prompt for your own generation task.",
    searchLibrary: "Search prompts or categories",
    searchAction: "Search",
    allCategories: "All categories",
    emptyLibrary: "No library assets yet",
    libraryDisabledTitle: "Asset library is closed",
    libraryDisabledHelp: "The administrator has temporarily closed the public asset library.",
    usePrompt: "Use prompt",
    newTask: "New task",
    selectedKey: "Selected key",
    keySelector: "API key",
    noKeys: "No API keys yet",
    noKeyHelp: "Create an API key before submitting generation tasks.",
    usageTitle: "Usage & quota",
    usageHelp: "Quota is tracked per API key. Select a key to inspect its limits and remaining images.",
    keysTitle: "API keys",
    keysHelp: "Create named keys for production services, staging apps, or internal tools.",
    createKey: "Create key",
    keyName: "Key name",
    select: "Select",
    selected: "Selected",
    deleteKey: "Delete",
    deleteKeyConfirm: "Delete this API key? Existing calls using this key will stop working.",
    deleteKeyFailed: "Failed to delete API key.",
    newKeySecret: "New API key",
    secretShownOnce: "This secret is shown once. Store it in the calling service.",
    copySecret: "Copy key",
    copied: "Copied",
    close: "Close",
    prompt: "Prompt",
    imageCount: "Images",
    size: "Size",
    quality: "Quality",
    low: "Low",
    medium: "Medium",
    high: "High",
    createTask: "Create task",
    totalUsed: "Total used",
    dailyUsed: "Daily used",
    remaining: "Remaining",
    dailyRemaining: "Daily remaining",
    concurrency: "Concurrency",
    unlimited: "Unlimited",
    tasksTotal: "Tasks",
    tasksActive: "Active",
    tasksSucceeded: "Succeeded",
    tasksFailed: "Failed",
    emptyTasks: "No tasks for this key yet",
    status: "Status",
    promptColumn: "Prompt",
    images: "Images",
    output: "Output",
    createdAt: "Created",
    open: "Open",
    noOutput: "-",
    chooseKeyFirst: "Create or select an API key first.",
    loadFailed: "Failed to load dashboard data.",
    createKeyFailed: "Failed to create API key.",
    createFailed: "Failed to create task.",
    defaultKeyName: "Production server",
    defaultPrompt: "A clean studio product image of a transparent glass perfume bottle",
    statusLabels: {
      active: "Active",
      disabled: "Disabled",
      queued: "Queued",
      running: "Running",
      succeeded: "Succeeded",
      failed: "Failed",
      canceled: "Canceled",
    },
  },
  zh: {
    eyebrow: "客户控制台",
    title: "图片生成控制台",
    subtitle: "在一个清晰的工作台里管理 API Keys、生成任务和用量额度。",
    home: "首页",
    admin: "管理",
    signOut: "退出",
    accessTitle: "客户控制台访问",
    accessHelp: "当前 Google 账号就是客户账号，会在当前浏览器保持登录。",
    invitationTitle: "使用 Google 登录",
    invitationHelp: "使用你的 Google 账号进入客户控制台，管理 API Keys、生成任务和用量额度。",
    invitationHint: "一个 Google 账号对应一个客户工作区；同一个客户工作区下面可以管理多个 API Key。",
    signInWithGoogle: "使用 Google 继续",
    googleUnavailable: "Google 登录尚未配置。",
    serviceUnavailable: "客户控制台服务暂时连接不上，请确认后端服务已启动后重试。",
    retry: "重试",
    signedIn: "已登录",
    noSession: "未登录",
    tabs: {
      tasks: "生成任务",
      library: "素材库",
      usage: "用量额度",
      keys: "API Keys",
      access: "访问设置",
    },
    tasksTitle: "生成任务",
    tasksHelp: "查看当前 API Key 最近的生图任务。",
    libraryTitle: "素材库",
    libraryHelp: "浏览已经筛过的提示词和参考图，把合适的 prompt 复用到自己的生成任务里。",
    searchLibrary: "搜索提示词或分类",
    searchAction: "搜索",
    allCategories: "全部分类",
    emptyLibrary: "素材库还没有内容",
    libraryDisabledTitle: "素材库暂未开放",
    libraryDisabledHelp: "管理员已经临时关闭公开素材库。",
    usePrompt: "使用提示词",
    newTask: "新建任务",
    selectedKey: "当前 key",
    keySelector: "API Key",
    noKeys: "还没有 API Key",
    noKeyHelp: "先创建 API Key，再提交生成任务。",
    usageTitle: "用量额度",
    usageHelp: "额度按 API Key 统计。选择一个 key 查看限制、已用量和剩余量。",
    keysTitle: "API Keys",
    keysHelp: "为生产服务、测试环境或内部工具创建命名 key。",
    createKey: "创建 key",
    keyName: "Key 名称",
    select: "选择",
    selected: "当前",
    deleteKey: "删除",
    deleteKeyConfirm: "确定删除这个 API Key 吗？正在使用这个 key 的调用会立即失效。",
    deleteKeyFailed: "删除 API Key 失败。",
    newKeySecret: "新 API Key",
    secretShownOnce: "密钥明文只显示一次，请保存到调用服务里。",
    copySecret: "复制 key",
    copied: "已复制",
    close: "关闭",
    prompt: "提示词",
    imageCount: "图片数",
    size: "尺寸",
    quality: "质量",
    low: "低",
    medium: "中",
    high: "高",
    createTask: "创建任务",
    totalUsed: "总用量",
    dailyUsed: "每日用量",
    remaining: "剩余额度",
    dailyRemaining: "今日剩余",
    concurrency: "并发数",
    unlimited: "不限",
    tasksTotal: "任务数",
    tasksActive: "进行中",
    tasksSucceeded: "已完成",
    tasksFailed: "失败",
    emptyTasks: "当前 key 暂无任务",
    status: "状态",
    promptColumn: "提示词",
    images: "图片",
    output: "输出",
    createdAt: "创建时间",
    open: "打开",
    noOutput: "-",
    chooseKeyFirst: "请先创建或选择一个 API Key。",
    loadFailed: "后台数据加载失败。",
    createKeyFailed: "创建 API Key 失败。",
    createFailed: "创建任务失败。",
    defaultKeyName: "生产服务",
    defaultPrompt: "一张干净的棚拍产品图，主体是一瓶透明玻璃香水",
    statusLabels: {
      active: "启用",
      disabled: "停用",
      queued: "排队中",
      running: "生成中",
      succeeded: "已完成",
      failed: "失败",
      canceled: "已取消",
    },
  },
};

const imageSizeOptions: Array<{ value: string; label: Record<Locale, string> }> = [
  { value: "1024x1024", label: { en: "Square 1:1 - 1024x1024", zh: "方图 1:1 - 1024x1024" } },
  { value: "1536x1024", label: { en: "Landscape 3:2 - 1536x1024", zh: "横图 3:2 - 1536x1024" } },
  { value: "1024x1536", label: { en: "Portrait 2:3 - 1024x1536", zh: "竖图 2:3 - 1024x1536" } },
  { value: "1024x1280", label: { en: "Portrait 4:5 - 1024x1280", zh: "竖图 4:5 - 1024x1280" } },
  { value: "1280x1024", label: { en: "Landscape 5:4 - 1280x1024", zh: "横图 5:4 - 1280x1024" } },
  { value: "1920x1080", label: { en: "Wide 16:9 - 1920x1080", zh: "宽屏 16:9 - 1920x1080" } },
  { value: "1080x1920", label: { en: "Vertical 9:16 - 1080x1920", zh: "竖屏 9:16 - 1080x1920" } },
];

const navItems: Array<{ id: ClientView; icon: ComponentType<{ className?: string }> }> = [
  { id: "tasks", icon: LayoutList },
  { id: "library", icon: ImageIcon },
  { id: "usage", icon: BarChart3 },
  { id: "keys", icon: KeyRound },
  { id: "access", icon: UserRound },
];

export function ClientConsole() {
  const [locale, setLocale] = useLocale();
  const t = copy[locale];
  const [view, setView] = useState<ClientView>("tasks");
  const [modal, setModal] = useState<ModalType>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [apiKeys, setAPIKeys] = useState<APIKey[]>([]);
  const [selectedKeyID, setSelectedKeyID] = useState("");
  const selectedKey = apiKeys.find((key) => key.id === selectedKeyID) || apiKeys[0] || null;
  const [newKeyName, setNewKeyName] = useState(t.defaultKeyName);
  const [newPlainKey, setNewPlainKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [libraryAssets, setLibraryAssets] = useState<LibraryAsset[]>([]);
  const [libraryCategories, setLibraryCategories] = useState<LibraryCategory[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryEnabled, setLibraryEnabled] = useState(true);
  const [libraryCategory, setLibraryCategory] = useState("");
  const [libraryDraftQuery, setLibraryDraftQuery] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [prompt, setPrompt] = useState(t.defaultPrompt);
  const [imageCount, setImageCount] = useState(1);
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [deletingKeyID, setDeletingKeyID] = useState("");
  const [message, setMessage] = useState("");
  const [booted, setBooted] = useState(false);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [libraryPromptLoaded, setLibraryPromptLoaded] = useState(false);
  const [loginURL, setLoginURL] = useState("");
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);

  const resetDashboard = useCallback(() => {
    setDashboardLoaded(false);
    setCustomer(null);
    setAPIKeys([]);
    setQuota(null);
    setTasks([]);
    setTaskTotal(0);
  }, []);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => item.id !== "library" || libraryEnabled),
    [libraryEnabled],
  );

  const loadPublicSettings = useCallback(async () => {
    try {
      const settings = await libraryApi.settings();
      setLibraryEnabled(settings.library_public_enabled);
      if (!settings.library_public_enabled && view === "library") {
        setView("tasks");
      }
    } catch {
      setLibraryEnabled(true);
    }
  }, [view]);

  const refresh = useCallback(async (preferredKeyID = selectedKeyID) => {
    setLoading(true);
    setDashboardLoaded(false);
    setMessage("");
    try {
      const session = await clientPortalApi.session();
      setLoginURL(session.login_url || "");
      setGoogleConfigured(Boolean(session.google_configured));
      if (!session.authenticated || !session.customer) {
        resetDashboard();
        return;
      }
      setCustomer(session.customer);
      const keyResult = await clientPortalApi.apiKeys();
      setAPIKeys(keyResult.items);
      const nextKeyID =
        preferredKeyID && keyResult.items.some((key) => key.id === preferredKeyID)
          ? preferredKeyID
          : keyResult.items[0]?.id || "";
      setSelectedKeyID(nextKeyID);
      if (nextKeyID) {
        window.localStorage.setItem(selectedKeyStorageKey, nextKeyID);
        const [quotaResult, taskResult] = await Promise.all([
          clientPortalApi.quota(nextKeyID),
          clientPortalApi.tasks(nextKeyID),
        ]);
        setQuota(quotaResult.quota);
        setTasks(taskResult.items);
        setTaskTotal(taskResult.total);
      } else {
        setQuota(null);
        setTasks([]);
        setTaskTotal(0);
      }
      setDashboardLoaded(true);
    } catch (error) {
      resetDashboard();
      setLoginURL("");
      setGoogleConfigured(null);
      setMessage(error instanceof Error ? error.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [resetDashboard, selectedKeyID, t.loadFailed]);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    setMessage("");
    try {
      const settings = await libraryApi.settings();
      setLibraryEnabled(settings.library_public_enabled);
      if (!settings.library_public_enabled) {
        setLibraryAssets([]);
        setLibraryCategories([]);
        setLibraryTotal(0);
        setMessage(t.libraryDisabledHelp);
        setView("tasks");
        return;
      }
      const [assetResult, categoryResult] = await Promise.all([
        libraryApi.assets({ category: libraryCategory, q: libraryQuery, limit: 24 }),
        libraryApi.categories(),
      ]);
      setLibraryAssets(assetResult.items);
      setLibraryTotal(assetResult.total);
      setLibraryCategories(categoryResult.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.loadFailed);
    } finally {
      setLoadingLibrary(false);
    }
  }, [libraryCategory, libraryQuery, t.libraryDisabledHelp, t.loadFailed]);

  useEffect(() => {
    if (booted) {
      return;
    }
    const existingKeyID = window.localStorage.getItem(selectedKeyStorageKey) || "";
    setSelectedKeyID(existingKeyID);
    setBooted(true);
    void loadPublicSettings();
    void refresh(existingKeyID);
  }, [booted, loadPublicSettings, refresh]);

  useEffect(() => {
    if (!customer || view !== "library") {
      return;
    }
    void loadLibrary();
  }, [customer, loadLibrary, view]);

  useEffect(() => {
    if (!customer || !dashboardLoaded || libraryPromptLoaded) {
      return;
    }
    const storedPrompt = window.localStorage.getItem(libraryPromptStorageKey) || "";
    if (!storedPrompt.trim()) {
      setLibraryPromptLoaded(true);
      return;
    }
    setPrompt(storedPrompt);
    setView("tasks");
    window.localStorage.removeItem(libraryPromptStorageKey);
    if (selectedKey) {
      setMessage("");
      setModal("task");
    } else {
      setMessage(t.chooseKeyFirst);
      setModal("key");
    }
    setLibraryPromptLoaded(true);
  }, [customer, dashboardLoaded, libraryPromptLoaded, selectedKey, t.chooseKeyFirst]);

  useEffect(() => {
    setPrompt((current) => {
      const otherDefault = locale === "en" ? copy.zh.defaultPrompt : copy.en.defaultPrompt;
      return current === otherDefault ? t.defaultPrompt : current;
    });
    setNewKeyName((current) => {
      const otherDefault = locale === "en" ? copy.zh.defaultKeyName : copy.en.defaultKeyName;
      return current === otherDefault ? t.defaultKeyName : current;
    });
  }, [locale, t.defaultKeyName, t.defaultPrompt]);

  const taskStats = useMemo(() => ({
    active: tasks.filter((task) => task.status === "queued" || task.status === "running").length,
    succeeded: tasks.filter((task) => task.status === "succeeded").length,
    failed: tasks.filter((task) => task.status === "failed").length,
  }), [tasks]);

  function submitLibrarySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = libraryDraftQuery.trim();
    setLibraryQuery(nextQuery);
    if (nextQuery === libraryQuery) {
      void loadLibrary();
    }
  }

  function useLibraryPrompt(asset: LibraryAsset) {
    setPrompt(asset.normalized_prompt || asset.original_prompt);
    setView("tasks");
    if (!selectedKey) {
      setMessage(t.chooseKeyFirst);
      setModal("key");
      return;
    }
    setMessage("");
    setModal("task");
  }

  function signOut() {
    void clientPortalApi.logout();
    window.localStorage.removeItem(selectedKeyStorageKey);
    resetDashboard();
    setSelectedKeyID("");
    setNewPlainKey("");
    setModal(null);
  }

  async function createAPIKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer) {
      setMessage(t.noSession);
      return;
    }
    setCreatingKey(true);
    setMessage("");
    setCopied(false);
    try {
      const result = await clientPortalApi.createAPIKey({ name: newKeyName });
      setNewPlainKey(result.api_key);
      await refresh(result.key.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.createKeyFailed);
    } finally {
      setCreatingKey(false);
    }
  }

  async function selectKey(keyID: string) {
    setSelectedKeyID(keyID);
    window.localStorage.setItem(selectedKeyStorageKey, keyID);
    await refresh(keyID);
  }

  async function deleteKey(key: APIKey) {
    if (!window.confirm(t.deleteKeyConfirm)) {
      return;
    }
    setDeletingKeyID(key.id);
    setMessage("");
    try {
      await clientPortalApi.deleteAPIKey(key.id);
      if (selectedKeyID === key.id) {
        window.localStorage.removeItem(selectedKeyStorageKey);
      }
      await refresh(selectedKeyID === key.id ? "" : selectedKeyID);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.deleteKeyFailed);
    } finally {
      setDeletingKeyID("");
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer || !selectedKey) {
      setMessage(t.chooseKeyFirst);
      return;
    }
    setCreatingTask(true);
    setMessage("");
    try {
      await clientPortalApi.createTask(selectedKey.id, {
        prompt,
        image_count: imageCount,
        size,
        quality,
        output_format: "png",
      });
      setModal(null);
      await refresh(selectedKey.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.createFailed);
    } finally {
      setCreatingTask(false);
    }
  }

  async function copyNewKey() {
    if (!newPlainKey) {
      return;
    }
    await navigator.clipboard.writeText(newPlainKey);
    setCopied(true);
  }

  if (!customer) {
    return (
      <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-6xl flex-col">
          <TopBar locale={locale} setLocale={setLocale} t={t} />
          <div className="flex flex-1 items-center justify-center py-12">
            <Card className="w-full max-w-xl">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-brand-300">{t.eyebrow}</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">{t.accessTitle}</h1>
                    <p className="mt-2 text-sm text-surface-400">{t.invitationHelp}</p>
                  </div>
                  <Badge tone="amber">{t.noSession}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {message ? <Notice>{message}</Notice> : null}
                <div className="rounded-lg border border-white/8 bg-surface-950/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-brand-200">
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" aria-hidden="true" />}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">{t.invitationTitle}</h2>
                      <p className="mt-1 text-sm text-surface-400">{t.invitationHint}</p>
                      {loginURL && googleConfigured !== false ? (
                        <a href={loginURL} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white px-4 text-sm font-semibold text-surface-950 transition hover:bg-surface-100">
                          <UserRound className="h-4 w-4" aria-hidden="true" />
                          {t.signInWithGoogle}
                        </a>
                      ) : (
                        <div className="mt-4 space-y-3">
                          <div className="text-sm text-amber-200">
                            {loading ? "..." : googleConfigured === false ? t.googleUnavailable : t.serviceUnavailable}
                          </div>
                          {!loading && googleConfigured !== false ? (
                            <Button variant="secondary" onClick={() => void refresh()}>
                              <RefreshCw className="h-4 w-4" />
                              {t.retry}
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        <aside className="hidden w-72 shrink-0 border-r border-white/8 px-5 py-6 lg:block">
          <Brand customer={customer} />
          <nav className="mt-8 space-y-1">
            {visibleNavItems.map((item) => (
              <NavButton
                key={item.id}
                active={view === item.id}
                icon={item.icon}
                label={t.tabs[item.id]}
                onClick={() => setView(item.id)}
              />
            ))}
          </nav>
          <div className="mt-8 border-t border-white/8 pt-4">
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              {t.signOut}
            </Button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-5 flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="lg:hidden">
                <Brand customer={customer} compact />
              </div>
              <p className="mt-3 text-xs font-medium text-brand-300 lg:mt-0">{t.eyebrow}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white">{t.tabs[view]}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <KeySelect
                value={selectedKey?.id || ""}
                keys={apiKeys}
                label={t.keySelector}
                onChange={(keyID) => void selectKey(keyID)}
              />
              <LanguageToggle locale={locale} onChange={setLocale} />
              <Link href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10">
                <Home className="h-4 w-4" aria-hidden="true" />
                {t.home}
              </Link>
              <Button variant="secondary" onClick={() => view === "library" ? void loadLibrary() : void refresh()} disabled={(view === "library" ? loadingLibrary : loading) || !customer}>
                {(view === "library" ? loadingLibrary : loading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </header>

          <MobileNav view={view} setView={setView} t={t} items={visibleNavItems} />

          {message ? <Notice>{message}</Notice> : null}

          {view === "tasks" ? (
            <TasksTab
              t={t}
              locale={locale}
              tasks={tasks}
              taskTotal={taskTotal}
              taskStats={taskStats}
              selectedKey={selectedKey}
              onNewTask={() => setModal("task")}
              onCreateKey={() => setModal("key")}
            />
          ) : null}

          {view === "library" && libraryEnabled ? (
            <LibraryTab
              t={t}
              assets={libraryAssets}
              categories={libraryCategories}
              total={libraryTotal}
              category={libraryCategory}
              query={libraryDraftQuery}
              loading={loadingLibrary}
              onCategoryChange={setLibraryCategory}
              onQueryChange={setLibraryDraftQuery}
              onSearch={submitLibrarySearch}
              onUsePrompt={useLibraryPrompt}
            />
          ) : null}

          {view === "usage" ? <UsageTab t={t} quota={quota} selectedKey={selectedKey} /> : null}

          {view === "keys" ? (
            <KeysTab
              t={t}
              keys={apiKeys}
              selectedKeyID={selectedKey?.id || ""}
              onSelect={(keyID) => void selectKey(keyID)}
              onCreate={() => {
                setNewPlainKey("");
                setCopied(false);
                setModal("key");
              }}
              deletingKeyID={deletingKeyID}
              onDelete={(key) => void deleteKey(key)}
            />
          ) : null}

          {view === "access" ? (
            <AccessTab
              t={t}
              customer={customer}
              onSignOut={signOut}
            />
          ) : null}
        </section>
      </div>

      <Modal open={modal === "task"} title={t.newTask} onClose={() => setModal(null)}>
        <form className="grid gap-4" onSubmit={(event) => void createTask(event)}>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-surface-500">{t.prompt}</span>
            <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1.5 block text-xs font-medium text-surface-500">{t.imageCount}</span>
              <Input type="number" min={1} max={10} value={imageCount} onChange={(event) => setImageCount(Number(event.target.value))} />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-surface-500">{t.size}</span>
              <select
                value={size}
                onChange={(event) => setSize(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none"
              >
                {imageSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[locale]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-surface-500">{t.quality}</span>
              <select
                value={quality}
                onChange={(event) => setQuality(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none"
              >
                <option value="low">{t.low}</option>
                <option value="medium">{t.medium}</option>
                <option value="high">{t.high}</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>{t.close}</Button>
            <Button type="submit" disabled={creatingTask || !selectedKey || !customer}>
              {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {t.createTask}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "key"} title={t.createKey} onClose={() => setModal(null)}>
        {newPlainKey ? (
          <div className="space-y-4">
            <Notice tone="green">
              <div className="font-medium">{t.newKeySecret}</div>
              <div className="mt-1">{t.secretShownOnce}</div>
            </Notice>
            <div className="break-all rounded-lg border border-white/10 bg-surface-950/70 p-3 font-mono text-xs text-white">
              {newPlainKey}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => void copyNewKey()}>
                <Copy className="h-4 w-4" />
                {copied ? t.copied : t.copySecret}
              </Button>
              <Button onClick={() => setModal(null)}>{t.close}</Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(event) => void createAPIKey(event)}>
            <label>
              <span className="mb-1.5 block text-xs font-medium text-surface-500">{t.keyName}</span>
              <Input value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>{t.close}</Button>
              <Button type="submit" disabled={!customer || creatingKey}>
                {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t.createKey}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}

function TopBar({ locale, setLocale, t }: { locale: Locale; setLocale: (locale: Locale) => void; t: ClientCopy }) {
  return (
    <header className="flex items-center justify-between border-b border-white/8 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Imagen</div>
          <div className="text-xs text-surface-400">{t.title}</div>
        </div>
      </div>
      <LanguageToggle locale={locale} onChange={setLocale} />
    </header>
  );
}

function Brand({ customer, compact = false }: { customer: Customer; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-600 text-white shadow-lg shadow-brand-600/25">
        <ImageIcon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold text-white">Imagen</div>
        {!compact ? <div className="truncate text-xs text-surface-400">{customer.name}</div> : null}
      </div>
    </div>
  );
}

function NavButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
        active ? "bg-brand-600 text-white shadow-lg shadow-brand-600/15" : "text-surface-300 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function MobileNav({
  view,
  setView,
  t,
  items,
}: {
  view: ClientView;
  setView: (view: ClientView) => void;
  t: ClientCopy;
  items: Array<{ id: ClientView; icon: ComponentType<{ className?: string }> }>;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:hidden">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setView(item.id)}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-medium",
            view === item.id ? "border-brand-400/40 bg-brand-500/20 text-white" : "border-white/8 bg-white/5 text-surface-300",
          )}
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          {t.tabs[item.id]}
        </button>
      ))}
    </div>
  );
}

function KeySelect({
  value,
  keys,
  label,
  onChange,
}: {
  value: string;
  keys: APIKey[];
  label: string;
  onChange: (keyID: string) => void;
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-surface-300">
      <span className="hidden text-xs text-surface-500 sm:inline">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[220px] bg-transparent text-sm font-medium text-white outline-none"
        disabled={!keys.length}
      >
        {keys.length ? keys.map((key) => (
          <option key={key.id} className="bg-surface-900" value={key.id}>
            {key.name || key.key_prefix}
          </option>
        )) : <option className="bg-surface-900" value="">-</option>}
      </select>
    </label>
  );
}

function TasksTab({
  t,
  locale,
  tasks,
  taskTotal,
  taskStats,
  selectedKey,
  onNewTask,
  onCreateKey,
}: {
  t: ClientCopy;
  locale: Locale;
  tasks: ImageTask[];
  taskTotal: number;
  taskStats: { active: number; succeeded: number; failed: number };
  selectedKey: APIKey | null;
  onNewTask: () => void;
  onCreateKey: () => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title={t.tasksTitle}
        description={t.tasksHelp}
        action={selectedKey ? (
          <Button onClick={onNewTask}>
            <Plus className="h-4 w-4" />
            {t.newTask}
          </Button>
        ) : (
          <Button onClick={onCreateKey}>
            <Plus className="h-4 w-4" />
            {t.createKey}
          </Button>
        )}
      />
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={LayoutList} label={t.tasksTotal} value={taskTotal || tasks.length} />
        <MetricCard icon={RefreshCw} label={t.tasksActive} value={taskStats.active} />
        <MetricCard icon={Sparkles} label={t.tasksSucceeded} value={taskStats.succeeded} />
        <MetricCard icon={ImageIcon} label={t.tasksFailed} value={taskStats.failed} />
      </div>
      {!selectedKey ? (
        <EmptyState title={t.noKeys} body={t.noKeyHelp} actionLabel={t.createKey} onAction={onCreateKey} />
      ) : (
        <TaskGrid tasks={tasks} t={t} locale={locale} />
      )}
    </div>
  );
}

function LibraryTab({
  t,
  assets,
  categories,
  total,
  category,
  query,
  loading,
  onCategoryChange,
  onQueryChange,
  onSearch,
  onUsePrompt,
}: {
  t: ClientCopy;
  assets: LibraryAsset[];
  categories: LibraryCategory[];
  total: number;
  category: string;
  query: string;
  loading: boolean;
  onCategoryChange: (category: string) => void;
  onQueryChange: (query: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  onUsePrompt: (asset: LibraryAsset) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader title={t.libraryTitle} description={t.libraryHelp} />
      <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]" onSubmit={onSearch}>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t.searchLibrary}
            className="pl-9"
          />
        </label>
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="h-10 rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none"
        >
          <option value="">{t.allCategories}</option>
          {categories.map((item) => (
            <option key={item.category || "uncategorized"} value={item.category} className="bg-surface-900">
              {item.category || "Uncategorized"} ({item.count})
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t.searchAction}
        </Button>
      </form>

      {loading && !assets.length ? (
        <Card>
          <CardContent className="flex min-h-72 items-center justify-center text-surface-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </CardContent>
        </Card>
      ) : assets.length ? (
        <>
          <div className="text-xs text-surface-500">{assets.length} / {total}</div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {assets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <a href={asset.public_url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-surface-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.public_url}
                    alt={asset.title || asset.category || "Library asset"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </a>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="blue">{asset.category || "Uncategorized"}</Badge>
                    {asset.review_score ? <span className="text-xs text-surface-500">{asset.review_score.toFixed(2)}</span> : null}
                  </div>
                  <div>
                    <h3 className="line-clamp-2 text-sm font-semibold text-white">{asset.title || asset.legacy_asset_id}</h3>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-surface-400">
                      {asset.normalized_prompt || asset.original_prompt}
                    </p>
                  </div>
                  {asset.tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {asset.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-md border border-white/8 bg-white/5 px-2 py-1 text-[11px] text-surface-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <Button className="w-full" onClick={() => onUsePrompt(asset)}>
                    <Sparkles className="h-4 w-4" />
                    {t.usePrompt}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <EmptyState title={t.emptyLibrary} body={t.libraryHelp} icon={ImageIcon} />
      )}
    </div>
  );
}

function UsageTab({ t, quota, selectedKey }: { t: ClientCopy; quota: Quota | null; selectedKey: APIKey | null }) {
  return (
    <div className="space-y-5">
      <SectionHeader title={t.usageTitle} description={t.usageHelp} />
      {!selectedKey ? (
        <EmptyState title={t.noKeys} body={t.noKeyHelp} />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{selectedKey.name || selectedKey.key_prefix}</h2>
                  <p className="mt-1 font-mono text-xs text-surface-500">{selectedKey.key_prefix}</p>
                </div>
                <StatusBadge status={selectedKey.status} labels={t.statusLabels} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <QuotaItem label={t.totalUsed} value={quota ? usageText(quota.image_used_total, quota.image_limit_total, t.unlimited) : "-"} progress={quota ? usageProgress(quota.image_used_total, quota.image_limit_total) : 0} />
              <QuotaItem label={t.dailyUsed} value={quota ? usageText(quota.image_used_daily, quota.image_limit_daily, t.unlimited) : "-"} progress={quota ? usageProgress(quota.image_used_daily, quota.image_limit_daily) : 0} />
              <QuotaItem label={t.remaining} value={quota ? remainingText(quota.image_remaining, t.unlimited) : "-"} />
              <QuotaItem label={t.dailyRemaining} value={quota ? remainingText(quota.daily_remaining, t.unlimited) : "-"} />
              <QuotaItem label={t.concurrency} value={quota ? quota.max_concurrency || t.unlimited : "-"} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KeysTab({
  t,
  keys,
  selectedKeyID,
  onSelect,
  onCreate,
  deletingKeyID,
  onDelete,
}: {
  t: ClientCopy;
  keys: APIKey[];
  selectedKeyID: string;
  onSelect: (keyID: string) => void;
  onCreate: () => void;
  deletingKeyID: string;
  onDelete: (key: APIKey) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title={t.keysTitle}
        description={t.keysHelp}
        action={(
          <Button onClick={onCreate}>
            <Plus className="h-4 w-4" />
            {t.createKey}
          </Button>
        )}
      />
      <Card>
        <CardContent>
          {keys.length ? (
            <KeyTable
              keys={keys}
              selectedKeyID={selectedKeyID}
              deletingKeyID={deletingKeyID}
              onSelect={onSelect}
              onDelete={onDelete}
              t={t}
            />
          ) : (
            <EmptyState title={t.noKeys} body={t.noKeyHelp} actionLabel={t.createKey} onAction={onCreate} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccessTab({
  t,
  customer,
  onSignOut,
}: {
  t: ClientCopy;
  customer: Customer;
  onSignOut: () => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader title={t.accessTitle} description={t.accessHelp} />
      <Card>
        <CardContent className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div className="rounded-lg border border-white/8 bg-surface-950/50 p-4">
            <div className="text-xs text-surface-500">{t.signedIn}</div>
            <div className="mt-2 text-lg font-semibold text-white">{customer.name}</div>
            <div className="mt-1 text-sm text-surface-400">{customer.email || customer.portal_key_prefix}</div>
            <div className="mt-3 max-w-2xl text-sm text-surface-500">{t.accessHelp}</div>
          </div>
          <div className="flex items-start lg:justify-end">
            <Button variant="secondary" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              {t.signOut}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-normal text-white">{title}</h2>
        <p className="mt-1 text-sm text-surface-400">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function KeyTable({
  keys,
  selectedKeyID,
  deletingKeyID,
  onSelect,
  onDelete,
  t,
}: {
  keys: APIKey[];
  selectedKeyID: string;
  deletingKeyID: string;
  onSelect: (keyID: string) => void;
  onDelete: (key: APIKey) => void;
  t: ClientCopy;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {[t.keyName, "Prefix", t.status, t.totalUsed, t.dailyUsed, t.concurrency, ""].map((header) => (
              <th key={header} className="border-b border-white/8 px-3 py-2 text-xs font-medium text-surface-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id}>
              <td className="border-b border-white/6 px-3 py-3 font-medium text-white">{key.name || "-"}</td>
              <td className="border-b border-white/6 px-3 py-3 font-mono text-xs text-surface-400">{key.key_prefix}</td>
              <td className="border-b border-white/6 px-3 py-3"><StatusBadge status={key.status} labels={t.statusLabels} /></td>
              <td className="border-b border-white/6 px-3 py-3">{usageText(key.image_used_total, key.image_limit_total, t.unlimited)}</td>
              <td className="border-b border-white/6 px-3 py-3">{usageText(key.image_used_daily, key.image_limit_daily, t.unlimited)}</td>
              <td className="border-b border-white/6 px-3 py-3">{key.max_concurrency || t.unlimited}</td>
              <td className="border-b border-white/6 px-3 py-3">
                <div className="flex justify-end gap-2">
                <Button variant={selectedKeyID === key.id ? "primary" : "secondary"} className="h-8 px-3" onClick={() => onSelect(key.id)}>
                  {selectedKeyID === key.id ? t.selected : t.select}
                </Button>
                <Button variant="danger" className="h-8 px-3" disabled={deletingKeyID === key.id} onClick={() => onDelete(key)}>
                  {deletingKeyID === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {t.deleteKey}
                </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
  icon: Icon = KeyRound,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-surface-300">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-surface-400">{body}</p>
        {actionLabel && onAction ? (
          <Button className="mt-5" onClick={onAction}>
            <Plus className="h-4 w-4" />
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-surface-900/60 p-4 shadow-sm shadow-black/20">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-surface-500">{label}</span>
        <Icon className="h-4 w-4 text-brand-300" aria-hidden="true" />
      </div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function QuotaItem({ label, value, progress }: { label: string; value: ReactNode; progress?: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-surface-950/50 p-4">
      <div className="text-xs text-surface-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      {typeof progress === "number" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function TaskGrid({ tasks, t, locale }: { tasks: ImageTask[]; t: ClientCopy; locale: Locale }) {
  if (!tasks.length) {
    return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-white/10 text-sm text-surface-500">{t.emptyTasks}</div>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} t={t} locale={locale} />
      ))}
    </div>
  );
}

function TaskCard({ task, t, locale }: { task: ImageTask; t: ClientCopy; locale: Locale }) {
  const outputURLs = task.output_urls || [];
  const previewURLs = outputURLs.slice(0, 4);

  return (
    <Card className="overflow-hidden">
      {previewURLs.length ? (
        <div className={cn("grid aspect-[4/3] gap-1 bg-surface-950", previewURLs.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {previewURLs.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="group relative block min-h-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={task.prompt || "Generated image"}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-surface-950 text-surface-600">
          {task.status === "queued" || task.status === "running" ? (
            <Loader2 className="h-6 w-6 animate-spin text-brand-300" aria-hidden="true" />
          ) : (
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
          )}
        </div>
      )}

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={task.status} labels={t.statusLabels} />
          <span className="text-xs text-surface-500">{formatDate(task.created_at, locale)}</span>
        </div>

        <p className="line-clamp-3 min-h-16 text-sm leading-6 text-white">{task.prompt}</p>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <TaskMeta label={t.images} value={`${task.output_image_count} / ${task.image_count}`} />
          <TaskMeta label={t.size} value={task.size || "-"} />
          <TaskMeta label={t.quality} value={task.quality || "-"} />
        </div>

        {task.error ? (
          <div className="line-clamp-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100">
            {task.error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="truncate font-mono text-[11px] text-surface-500">{task.id}</span>
          {outputURLs.length ? (
            <a href={outputURLs[0]} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white hover:bg-white/10">
              {t.open}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-xs text-surface-500">{t.noOutput}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-surface-950/55 px-3 py-2">
      <div className="text-[11px] text-surface-500">{label}</div>
      <div className="mt-1 truncate font-medium text-surface-200">{value}</div>
    </div>
  );
}

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const tone = status === "succeeded" || status === "active" ? "green" : status === "queued" || status === "running" ? "blue" : status === "failed" || status === "disabled" ? "red" : "neutral";
  return <Badge tone={tone}>{statusLabel(status, labels)}</Badge>;
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-surface-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Notice({ children, tone = "amber" }: { children: ReactNode; tone?: "amber" | "green" }) {
  return (
    <div className={cn(
      "mb-4 rounded-lg border px-4 py-3 text-sm",
      tone === "amber" && "border-amber-400/20 bg-amber-400/10 text-amber-100",
      tone === "green" && "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    )}>
      {children}
    </div>
  );
}

function statusLabel(status: string, labels: Record<string, string>) {
  return labels[status] || status || "-";
}

function usageText(used: number, limit: number, unlimited: string) {
  if (!limit || limit < 0) {
    return `${used} / ${unlimited}`;
  }
  return `${used} / ${limit}`;
}

function remainingText(value: number, unlimited: string) {
  if (value < 0) {
    return unlimited;
  }
  return value;
}

function usageProgress(used: number, limit: number) {
  if (!limit || limit < 0) {
    return 0;
  }
  return (used / limit) * 100;
}

function formatDate(value: string, locale: Locale) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(dateLocale(locale));
}
