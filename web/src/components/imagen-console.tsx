"use client";

import {
  Activity,
  ArrowUpRight,
  HardDrive,
  ImageIcon,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  ServerCog,
  Settings,
  Plus,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { imagenApi } from "@/lib/api";
import type {
  APIKey,
  AdminUser,
  Customer,
  ImageTask,
  LibraryAsset,
  Overview,
  ProviderAccount,
  Settings as SettingsData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "overview" | "customers" | "keys" | "tasks" | "library" | "accounts" | "settings";

type LoadState = {
  user: AdminUser | null;
  overview: Overview | null;
  customers: Customer[];
  keys: APIKey[];
  tasks: ImageTask[];
  taskTotal: number;
  libraryAssets: LibraryAsset[];
  libraryTotal: number;
  accounts: ProviderAccount[];
  settings: SettingsData | null;
};

const navItems: Array<{ id: View; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "总览", icon: Activity },
  { id: "customers", label: "客户", icon: UsersRound },
  { id: "keys", label: "API 密钥", icon: KeyRound },
  { id: "tasks", label: "生成任务", icon: ImageIcon },
  { id: "library", label: "素材库", icon: ImageIcon },
  { id: "accounts", label: "引擎账号", icon: ServerCog },
  { id: "settings", label: "系统设置", icon: Settings },
];

const statusLabels: Record<string, string> = {
  active: "启用",
  disabled: "停用",
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消",
};

function isView(value: string | null): value is View {
  return Boolean(value && navItems.some((item) => item.id === value));
}

const emptyState: LoadState = {
  user: null,
  overview: null,
  customers: [],
  keys: [],
  tasks: [],
  taskTotal: 0,
  libraryAssets: [],
  libraryTotal: 0,
  accounts: [],
  settings: null,
};

export function ImagenConsole() {
  const [view, setView] = useState<View>("overview");
  const [state, setState] = useState<LoadState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [newKey, setNewKey] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const me = await imagenApi.me();
      if (!me.authenticated) {
        window.location.href = "/login";
        return;
      }
      const [overview, customers, keys, tasks, libraryAssets, accounts, settings] = await Promise.all([
        imagenApi.overview(),
        imagenApi.customers(),
        imagenApi.apiKeys(),
        imagenApi.tasks(),
        imagenApi.libraryAssets({ limit: 80 }),
        imagenApi.providerAccounts(),
        imagenApi.settings(),
      ]);
      setState({
        user: me.user,
        overview,
        customers: customers.items,
        keys: keys.items,
        tasks: tasks.items,
        taskTotal: tasks.total,
        libraryAssets: libraryAssets.items,
        libraryTotal: libraryAssets.total,
        accounts: accounts.items,
        settings,
      });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "控制台加载失败。");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    if (isView(requestedView)) {
      setView(requestedView);
    }
  }, []);

  const activeTitle = useMemo(() => navItems.find((item) => item.id === view)?.label || "总览", [view]);

  async function logout() {
    await imagenApi.logout();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1840px]">
        <aside className="hidden w-72 shrink-0 border-r border-white/8 px-5 py-6 lg:block">
          <Brand />
          <nav className="mt-8 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition",
                  view === item.id
                    ? "bg-brand-600 text-white shadow-lg shadow-brand-600/15"
                    : "text-surface-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-5 flex flex-col gap-4 border-b border-white/8 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="lg:hidden">
                <Brand />
              </div>
              <p className="mt-3 text-xs font-medium text-brand-300 lg:mt-0">Imagen 管理后台</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{activeTitle}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.user ? <UserPill user={state.user} /> : null}
              <Button variant="secondary" onClick={() => setView("customers")}>
                <UsersRound className="h-4 w-4" />
                客户
              </Button>
              <Button variant="secondary" onClick={() => void load()} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                刷新
              </Button>
              <Button variant="ghost" onClick={() => void logout()}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          <MobileNav view={view} onChange={setView} />

          {message ? (
            <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {message}
            </div>
          ) : null}

          {loading ? (
            <div className="flex h-[420px] items-center justify-center text-surface-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              正在加载控制台
            </div>
          ) : (
            <>
              {view === "overview" ? <OverviewPanel state={state} /> : null}
              {view === "customers" ? <CustomersPanel customers={state.customers} onRefresh={load} /> : null}
              {view === "keys" ? <KeysPanel keys={state.keys} customers={state.customers} onCreated={setNewKey} onRefresh={load} newKey={newKey} /> : null}
              {view === "tasks" ? <TasksPanel tasks={state.tasks} total={state.taskTotal} /> : null}
              {view === "library" ? <LibraryPanel assets={state.libraryAssets} total={state.libraryTotal} onRefresh={load} /> : null}
              {view === "accounts" ? <AccountsPanel accounts={state.accounts} onRefresh={load} /> : null}
              {view === "settings" ? <SettingsPanel settings={state.settings} onRefresh={load} /> : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
        <ImageIcon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-lg font-semibold text-white">Imagen</div>
        <div className="text-xs text-surface-400">批量生图平台</div>
      </div>
    </div>
  );
}

function MobileNav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:hidden">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-medium",
            view === item.id
              ? "border-brand-400/40 bg-brand-500/20 text-white"
              : "border-white/8 bg-white/5 text-surface-300",
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function UserPill({ user }: { user: AdminUser }) {
  const initials = user.name?.slice(0, 1) || user.email.slice(0, 1);
  return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-surface-200">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
        {initials.toUpperCase()}
      </span>
      <span className="max-w-[180px] truncate">{user.email}</span>
    </div>
  );
}

function OverviewPanel({ state }: { state: LoadState }) {
  const overview = state.overview;
  const counts = overview?.task_counts || {};
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric title="总任务数" value={overview?.total_tasks || 0} icon={ImageIcon} />
        <Metric title="产出图片" value={overview?.total_output_images || 0} icon={HardDrive} />
        <Metric title="素材库" value={overview?.library_assets || 0} icon={ImageIcon} />
        <Metric title="客户" value={overview?.customers || 0} icon={UsersRound} />
        <Metric title="API 密钥" value={overview?.api_keys || 0} icon={KeyRound} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-white">任务状态</h2>
            <p className="mt-1 text-sm text-surface-400">按当前任务状态汇总生成队列。</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {["queued", "running", "succeeded", "failed", "canceled"].map((status) => (
                <div key={status} className="rounded-xl border border-white/8 bg-surface-950/60 p-4">
                  <div className="text-xs text-surface-500">{statusLabel(status)}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{counts[status] || 0}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-white">存储</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="类型" value={overview?.storage_provider || "-"} />
            <Row label="状态" value={overview?.storage_ready ? "已就绪" : "未配置"} />
            <Row label="公网地址" value={overview?.storage_public_url || "-"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-sm text-surface-400">{title}</div>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-400/20 bg-brand-400/10 text-brand-200">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function CustomersPanel({
  customers,
  onRefresh,
}: {
  customers: Customer[];
  onRefresh: () => Promise<void>;
}) {
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState(1000);
  const [daily, setDaily] = useState(100);
  const [concurrency, setConcurrency] = useState(20);
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyID, setBusyID] = useState("");

  function openCreate() {
    setEditingCustomer(null);
    setName("");
    setEmail("");
    setTotal(1000);
    setDaily(100);
    setConcurrency(20);
    setStatus("active");
    setError("");
    setModal("create");
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer);
    setName(customer.name || "");
    setEmail(customer.email || "");
    setTotal(customer.default_image_limit_total);
    setDaily(customer.default_image_limit_daily);
    setConcurrency(customer.default_max_concurrency);
    setStatus(customer.status || "active");
    setError("");
    setModal("edit");
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (modal === "edit" && editingCustomer) {
        await imagenApi.updateCustomer(editingCustomer.id, {
          name,
          email,
          status,
          default_image_limit_total: total,
          default_image_limit_daily: daily,
          default_max_concurrency: concurrency,
        });
      } else {
        await imagenApi.createCustomer({
          name,
          email,
          status,
          default_image_limit_total: total,
          default_image_limit_daily: daily,
          default_max_concurrency: concurrency,
        });
      }
      await onRefresh();
      setModal(null);
      setEditingCustomer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存客户失败。");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCustomer(customer: Customer) {
    setBusyID(customer.id);
    setError("");
    try {
      await imagenApi.updateCustomer(customer.id, {
        status: customer.status === "active" ? "disabled" : "active",
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新客户失败。");
    } finally {
      setBusyID("");
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`确定删除客户「${customer.name || customer.email || customer.id}」吗？它下面的 API Key、任务和批次也会一起删除。`)) {
      return;
    }
    setBusyID(customer.id);
    setError("");
    try {
      await imagenApi.deleteCustomer(customer.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除客户失败。");
    } finally {
      setBusyID("");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">客户列表</h2>
            <p className="mt-1 text-sm text-surface-400">客户用 Google 邮箱登录客户端；默认额度会用于它新建的 API Key。</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增客户
          </Button>
        </CardHeader>
        <CardContent>
          {error && !modal ? (
            <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <DataTable
            headers={["名称", "Google 邮箱", "状态", "默认总量", "默认每日", "默认并发", "操作"]}
            rows={customers.map((customer) => [
              customer.name || "-",
              customer.email || "-",
              <StatusBadge key={customer.id} status={customer.status} />,
              customer.default_image_limit_total < 0 ? "不限" : customer.default_image_limit_total,
              customer.default_image_limit_daily || "不限",
              customer.default_max_concurrency || "不限",
              <div key={customer.id} className="flex justify-end gap-2">
                <Button variant="secondary" className="h-8 px-3" onClick={() => openEdit(customer)}>
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  disabled={busyID === customer.id}
                  onClick={() => void toggleCustomer(customer)}
                >
                  {busyID === customer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {customer.status === "active" ? "停用" : "启用"}
                </Button>
                <Button
                  variant="danger"
                  className="h-8 px-3"
                  disabled={busyID === customer.id}
                  onClick={() => void deleteCustomer(customer)}
                >
                  {busyID === customer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  删除
                </Button>
              </div>,
            ])}
          />
        </CardContent>
      </Card>

      <AdminModal open={Boolean(modal)} title={modal === "edit" ? "编辑客户" : "新增客户"} onClose={() => setModal(null)}>
        <form className="space-y-3" onSubmit={(event) => void saveCustomer(event)}>
          <Field label="名称"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Google 邮箱"><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></Field>
          <Field label="状态">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClassName}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="默认总图片额度"><Input type="number" value={total} onChange={(event) => setTotal(Number(event.target.value))} /></Field>
            <Field label="默认每日额度"><Input type="number" value={daily} onChange={(event) => setDaily(Number(event.target.value))} /></Field>
            <Field label="默认并发数"><Input type="number" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></Field>
          </div>
          {error && modal ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>取消</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UsersRound className="h-4 w-4" />}
              保存
            </Button>
          </div>
        </form>
      </AdminModal>
    </>
  );
}

function KeysPanel({
  keys,
  customers,
  onCreated,
  onRefresh,
  newKey,
}: {
  keys: APIKey[];
  customers: Customer[];
  onCreated: (key: string) => void;
  onRefresh: () => Promise<void>;
  newKey: string;
}) {
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingKey, setEditingKey] = useState<APIKey | null>(null);
  const [name, setName] = useState("");
  const [customerID, setCustomerID] = useState("");
  const [status, setStatus] = useState("active");
  const [total, setTotal] = useState(1000);
  const [daily, setDaily] = useState(100);
  const [concurrency, setConcurrency] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyID, setBusyID] = useState("");
  const customerByID = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const keyStats = useMemo(
    () => ({
      total: keys.length,
      active: keys.filter((key) => key.status === "active").length,
      bound: keys.filter((key) => key.customer_id).length,
      dailyUsed: keys.reduce((sum, key) => sum + key.image_used_daily, 0),
    }),
    [keys],
  );

  function openCreate() {
    const firstCustomer = customers[0];
    setEditingKey(null);
    setName("");
    setCustomerID(firstCustomer?.id || "");
    setStatus("active");
    setTotal(firstCustomer?.default_image_limit_total ?? 1000);
    setDaily(firstCustomer?.default_image_limit_daily ?? 100);
    setConcurrency(firstCustomer?.default_max_concurrency ?? 20);
    setError("");
    onCreated("");
    setModal("create");
  }

  function openEdit(key: APIKey) {
    setEditingKey(key);
    setName(key.name || "");
    setCustomerID(key.customer_id || "");
    setStatus(key.status || "active");
    setTotal(key.image_limit_total);
    setDaily(key.image_limit_daily);
    setConcurrency(key.max_concurrency);
    setError("");
    onCreated("");
    setModal("edit");
  }

  async function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (modal === "edit" && editingKey) {
        await imagenApi.updateAPIKey(editingKey.id, {
          name,
          status,
          image_limit_total: total,
          image_limit_daily: daily,
          max_concurrency: concurrency,
        });
      } else {
        const result = await imagenApi.createAPIKey({
          name,
          customer_id: customerID,
          image_limit_total: total,
          image_limit_daily: daily,
          max_concurrency: concurrency,
        });
        onCreated(result.api_key);
      }
      await onRefresh();
      setModal(null);
      setEditingKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 API 密钥失败。");
    } finally {
      setSaving(false);
    }
  }

  async function toggleKey(key: APIKey) {
    setBusyID(key.id);
    setError("");
    onCreated("");
    try {
      await imagenApi.updateAPIKey(key.id, {
        status: key.status === "active" ? "disabled" : "active",
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新 API 密钥失败。");
    } finally {
      setBusyID("");
    }
  }

  async function deleteKey(key: APIKey) {
    if (!window.confirm("确定删除这个 API 密钥吗？删除后使用它的调用会立即失效。")) {
      return;
    }
    setBusyID(key.id);
    setError("");
    onCreated("");
    try {
      await imagenApi.deleteAPIKey(key.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除 API 密钥失败。");
    } finally {
      setBusyID("");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">API 密钥列表</h2>
            <p className="mt-1 text-sm text-surface-400">给客户、环境或调用方分配独立密钥，单独控制额度和并发。</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增 API 密钥
          </Button>
        </CardHeader>
        <CardContent>
          {error && !modal ? (
            <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {newKey ? (
            <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="text-xs font-medium text-emerald-200">新密钥明文只显示一次</div>
              <div className="mt-2 break-all font-mono text-xs text-emerald-50">{newKey}</div>
            </div>
          ) : null}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KeyStat label="密钥总数" value={keyStats.total} />
            <KeyStat label="启用密钥" value={keyStats.active} />
            <KeyStat label="已绑定客户" value={keyStats.bound} />
            <KeyStat label="今日已用图片" value={keyStats.dailyUsed} />
          </div>
          <APIKeyTable
            keys={keys}
            customerByID={customerByID}
            busyID={busyID}
            onEdit={openEdit}
            onToggle={(key) => void toggleKey(key)}
            onDelete={(key) => void deleteKey(key)}
          />
        </CardContent>
      </Card>

      <AdminModal open={Boolean(modal)} title={modal === "edit" ? "编辑 API 密钥" : "新增 API 密钥"} onClose={() => setModal(null)}>
        <form className="space-y-3" onSubmit={(event) => void saveKey(event)}>
          <Field label="名称"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="生产服务 / 测试环境" /></Field>
          <Field label="客户归属">
            <select
              value={customerID}
              onChange={(event) => setCustomerID(event.target.value)}
              className={selectClassName}
              disabled={modal === "edit"}
            >
              <option value="">未绑定客户</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerLabel(customer, customer.id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="状态">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClassName}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="总图片额度"><Input type="number" value={total} onChange={(event) => setTotal(Number(event.target.value))} /></Field>
            <Field label="每日额度"><Input type="number" value={daily} onChange={(event) => setDaily(Number(event.target.value))} /></Field>
            <Field label="并发数"><Input type="number" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></Field>
          </div>
          {error && modal ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>取消</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              保存
            </Button>
          </div>
        </form>
      </AdminModal>
    </>
  );
}

function KeyStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-surface-950/45 px-4 py-3">
      <div className="text-xs text-surface-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function APIKeyTable({
  keys,
  customerByID,
  busyID,
  onEdit,
  onToggle,
  onDelete,
}: {
  keys: APIKey[];
  customerByID: Map<string, Customer>;
  busyID: string;
  onEdit: (key: APIKey) => void;
  onToggle: (key: APIKey) => void;
  onDelete: (key: APIKey) => void;
}) {
  if (keys.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-surface-500">
        暂无 API 密钥
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/8">
      <table className="w-full min-w-[1450px] table-fixed border-separate border-spacing-0 text-left text-sm">
        <colgroup>
          <col className="w-[190px]" />
          <col className="w-[120px]" />
          <col className="w-[230px]" />
          <col className="w-[90px]" />
          <col className="w-[165px]" />
          <col className="w-[170px]" />
          <col className="w-[80px]" />
          <col className="w-[145px]" />
          <col className="w-[145px]" />
          <col className="w-[110px]" />
        </colgroup>
        <thead>
          <tr className="bg-surface-950/60">
            {["名称", "前缀", "客户", "状态", "总额度", "今日额度", "并发", "最近使用", "创建时间", "操作"].map((header) => (
              <th key={header} className="border-b border-white/8 px-3 py-2 text-xs font-medium text-surface-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => {
            const customer = key.customer_id ? customerByID.get(key.customer_id) : undefined;
            const customerName = key.customer_id ? customerLabel(customer, key.customer_id) : "未绑定客户";
            const busy = busyID === key.id;

            return (
              <tr key={key.id} className="group">
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <div className="truncate font-medium text-white" title={key.name || "未命名密钥"}>
                    {key.name || "未命名密钥"}
                  </div>
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <span className="inline-flex max-w-full truncate rounded-md border border-white/8 bg-white/5 px-2 py-1 font-mono text-[11px] text-surface-300">
                    {key.key_prefix || "-"}
                  </span>
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <div className="truncate text-surface-200" title={customerName}>{customerName}</div>
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <StatusBadge status={key.status} />
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <QuotaCell used={key.image_used_total} limit={key.image_limit_total} />
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <QuotaCell used={key.image_used_daily} limit={key.image_limit_daily} />
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <div className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-white/8 bg-white/5 px-2 text-xs font-medium text-white">
                    {key.max_concurrency || "不限"}
                  </div>
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle text-xs text-surface-400 group-hover:bg-white/[0.02]">
                  {formatCompactDate(key.last_used_at)}
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle text-xs text-surface-400 group-hover:bg-white/[0.02]">
                  {formatCompactDate(key.created_at)}
                </td>
                <td className="border-b border-white/6 px-3 py-2 align-middle group-hover:bg-white/[0.02]">
                  <APIKeyActionSelect
                    apiKey={key}
                    busy={busy}
                    onEdit={onEdit}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function APIKeyActionSelect({
  apiKey,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  apiKey: APIKey;
  busy: boolean;
  onEdit: (key: APIKey) => void;
  onToggle: (key: APIKey) => void;
  onDelete: (key: APIKey) => void;
}) {
  function handleAction(action: string) {
    if (action === "edit") {
      onEdit(apiKey);
    }
    if (action === "toggle") {
      onToggle(apiKey);
    }
    if (action === "delete") {
      onDelete(apiKey);
    }
  }

  if (busy) {
    return (
      <div className="inline-flex h-8 w-[86px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-surface-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        处理中
      </div>
    );
  }

  return (
    <select
      value=""
      aria-label={`操作 ${apiKey.name || apiKey.key_prefix || apiKey.id}`}
      onChange={(event) => handleAction(event.target.value)}
      className="h-8 w-[86px] rounded-lg border border-white/10 bg-surface-950/70 px-2 text-xs font-medium text-white outline-none transition hover:border-white/20 focus:border-brand-400/70 focus:ring-2 focus:ring-brand-500/20"
    >
      <option value="" disabled className="bg-surface-900 text-surface-300">操作</option>
      <option value="edit" className="bg-surface-900 text-white">编辑</option>
      <option value="toggle" className="bg-surface-900 text-white">{apiKey.status === "active" ? "停用" : "启用"}</option>
      <option value="delete" className="bg-surface-900 text-rose-200">删除</option>
    </select>
  );
}

function QuotaCell({ used, limit }: { used: number; limit: number }) {
  const percent = quotaPercent(used, limit);
  const limited = limit > 0;

  return (
    <div className="min-w-[130px]">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-surface-200">{usageText(used, limit)}</span>
        <span className="text-surface-500">{limited ? `${percent}%` : "不限"}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-800">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            percent >= 90 ? "bg-rose-400" : percent >= 70 ? "bg-amber-300" : "bg-brand-400",
          )}
          style={{ width: limited ? `${percent}%` : "0%" }}
        />
      </div>
    </div>
  );
}

function TasksPanel({ tasks, total }: { tasks: ImageTask[]; total: number }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-normal text-white">任务列表</h2>
          <p className="mt-1 text-sm text-surface-400">共 {total} 个任务，按创建时间倒序展示。</p>
        </div>
      </div>

      {tasks.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tasks.map((task) => (
            <AdminTaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-surface-500">
          暂无生成任务
        </div>
      )}
    </div>
  );
}

function AdminTaskCard({ task }: { task: ImageTask }) {
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
          <StatusBadge status={task.status} />
          <span className="text-xs text-surface-500">{formatAdminDate(task.created_at)}</span>
        </div>

        <p className="line-clamp-3 min-h-16 text-sm leading-6 text-white">{task.prompt}</p>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <AdminTaskMeta label="图片" value={`${task.output_image_count} / ${task.image_count}`} />
          <AdminTaskMeta label="尺寸" value={task.size || "-"} />
          <AdminTaskMeta label="质量" value={task.quality || "-"} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <AdminTaskMeta label="耗时" value={task.duration_millis ? `${Math.round(task.duration_millis / 1000)}s` : "-"} />
          <AdminTaskMeta label="尝试" value={task.attempt || 0} />
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
              打开
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span className="text-xs text-surface-500">暂无输出</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdminTaskMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-surface-950/55 px-3 py-2">
      <div className="text-[11px] text-surface-500">{label}</div>
      <div className="mt-1 truncate font-medium text-surface-200">{value}</div>
    </div>
  );
}

function LibraryPanel({ assets, total, onRefresh }: { assets: LibraryAsset[]; total: number; onRefresh: () => Promise<void> }) {
  const [items, setItems] = useState(assets);
  const [itemTotal, setItemTotal] = useState(total);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyID, setBusyID] = useState("");
  const [error, setError] = useState("");
  const featuredCount = items.filter((asset) => asset.featured).length;

  useEffect(() => {
    setItems(assets);
    setItemTotal(total);
  }, [assets, total]);

  async function searchAssets(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await imagenApi.libraryAssets({ q: query.trim(), limit: 80 });
      setItems(result.items);
      setItemTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载素材失败。");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFeatured(asset: LibraryAsset) {
    setBusyID(asset.id);
    setError("");
    try {
      const result = await imagenApi.updateLibraryAsset(asset.id, { featured: !asset.featured });
      setItems((current) => current.map((item) => item.id === asset.id ? result.asset : item));
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新首页推荐失败。");
    } finally {
      setBusyID("");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">素材库</h2>
            <p className="mt-1 text-sm text-surface-400">标记首页推荐后，主页右侧会从这里自动展示 4 张样图。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="blue">{itemTotal} 个素材</Badge>
            <Badge tone={featuredCount ? "green" : "amber"}>{featuredCount} 个已推荐</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void searchAssets(event)}>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、分类或 prompt"
              className="border-white/10 bg-surface-950/70"
            />
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              搜索
            </Button>
          </form>

          {error ? (
            <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((asset) => (
                <article key={asset.id} className="overflow-hidden rounded-lg border border-white/8 bg-surface-950/45">
                  <a href={asset.public_url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-surface-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.public_url}
                      alt={asset.title || asset.category || "素材"}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </a>
                  <div className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-white">{asset.title || asset.legacy_asset_id}</h3>
                        <p className="mt-1 truncate text-xs text-surface-500">{asset.category || "未分类"}</p>
                      </div>
                      {asset.featured ? <Badge tone="green">首页</Badge> : <Badge tone="neutral">普通</Badge>}
                    </div>
                    <p className="line-clamp-2 min-h-10 text-xs leading-5 text-surface-400">
                      {asset.normalized_prompt || asset.original_prompt}
                    </p>
                    <Button
                      className="w-full"
                      variant={asset.featured ? "secondary" : "primary"}
                      disabled={busyID === asset.id}
                      onClick={() => void toggleFeatured(asset)}
                    >
                      {busyID === asset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {asset.featured ? "取消首页推荐" : "设为首页推荐"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-surface-500">
              暂无素材
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsPanel({ accounts, onRefresh }: { accounts: ProviderAccount[]; onRefresh: () => Promise<void> }) {
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingAccount, setEditingAccount] = useState<ProviderAccount | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("active");
  const [concurrency, setConcurrency] = useState(1);
  const [daily, setDaily] = useState(500);
  const [weight, setWeight] = useState(100);
  const [engineHome, setEngineHome] = useState("");
  const [envText, setEnvText] = useState("");
  const [runnerAuthJson, setRunnerAuthJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyID, setBusyID] = useState("");

  function openCreate() {
    setEditingAccount(null);
    setName("");
    setStatus("active");
    setConcurrency(1);
    setDaily(500);
    setWeight(100);
    setEngineHome("");
    setEnvText("");
    setRunnerAuthJson("");
    setError("");
    setModal("create");
  }

  function openEdit(account: ProviderAccount) {
    setEditingAccount(account);
    setName(account.name || "");
    setStatus(account.status || "active");
    setConcurrency(account.max_concurrency || 1);
    setDaily(account.daily_image_limit || 0);
    setWeight(account.weight || 100);
    setEngineHome(account.engine_home || "");
    setEnvText("");
    setRunnerAuthJson("");
    setError("");
    setModal("edit");
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (modal === "edit" && editingAccount) {
        await imagenApi.updateProviderAccount(editingAccount.id, {
          name,
          status,
          max_concurrency: concurrency,
          daily_image_limit: daily,
          weight,
          engine_home: engineHome,
          env: parseEnv(envText),
          replace_env: envText.trim() !== "",
          runner_auth_json: runnerAuthJson,
        });
      } else {
        await imagenApi.createProviderAccount({
          name,
          status,
          max_concurrency: concurrency,
          daily_image_limit: daily,
          weight,
          engine_home: engineHome,
          env: parseEnv(envText),
          runner_auth_json: runnerAuthJson,
        });
      }
      setEnvText("");
      setRunnerAuthJson("");
      await onRefresh();
      setModal(null);
      setEditingAccount(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存引擎账号失败。");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAccount(account: ProviderAccount) {
    setBusyID(account.id);
    setError("");
    try {
      await imagenApi.updateProviderAccount(account.id, {
        status: account.status === "active" ? "disabled" : "active",
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新引擎账号失败。");
    } finally {
      setBusyID("");
    }
  }

  async function deleteAccount(account: ProviderAccount) {
    if (!window.confirm(`确定删除引擎账号「${account.name || account.id}」吗？`)) {
      return;
    }
    setBusyID(account.id);
    setError("");
    try {
      await imagenApi.deleteProviderAccount(account.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除引擎账号失败。");
    } finally {
      setBusyID("");
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">引擎账号</h2>
            <p className="mt-1 text-sm text-surface-400">账号用于生成队列调度；支持权重、并发、每日额度和认证配置。</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增引擎账号
          </Button>
        </CardHeader>
        <CardContent>
          {error && !modal ? (
            <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <DataTable
            headers={["名称", "状态", "权重", "并发", "每日用量", "认证", "运行目录", "环境变量", "最近错误", "操作"]}
            rows={accounts.map((account) => [
              account.name,
              <StatusBadge key={account.id} status={account.status} />,
              account.weight,
              `${account.running_count} / ${account.max_concurrency}`,
              usageText(account.daily_image_used, account.daily_image_limit),
              account.auth_configured ? <Badge key={account.id} tone="green">已安装</Badge> : <Badge key={account.id} tone="red">缺失</Badge>,
              account.engine_home ? <span key={account.id} className="max-w-[280px] break-all text-surface-400">{account.engine_home}</span> : "-",
              account.env_keys?.length ? account.env_keys.join(", ") : "-",
              account.last_error ? <span className="line-clamp-2 max-w-[320px] text-rose-200">{account.last_error}</span> : "-",
              <div key={account.id} className="flex justify-end gap-2">
                <Button variant="secondary" className="h-8 px-3" onClick={() => openEdit(account)}>
                  <Pencil className="h-3.5 w-3.5" />
                  编辑
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  disabled={busyID === account.id}
                  onClick={() => void toggleAccount(account)}
                >
                  {busyID === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {account.status === "active" ? "停用" : "启用"}
                </Button>
                <Button
                  variant="danger"
                  className="h-8 px-3"
                  disabled={busyID === account.id}
                  onClick={() => void deleteAccount(account)}
                >
                  {busyID === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  删除
                </Button>
              </div>,
            ])}
          />
        </CardContent>
      </Card>

      <AdminModal open={Boolean(modal)} title={modal === "edit" ? "编辑引擎账号" : "新增引擎账号"} onClose={() => setModal(null)}>
        <form className="space-y-3" onSubmit={(event) => void saveAccount(event)}>
          <Field label="名称"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="引擎账号 1" /></Field>
          <Field label="状态">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClassName}>
              <option value="active">启用</option>
              <option value="disabled">停用</option>
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="并发"><Input type="number" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></Field>
            <Field label="每日额度"><Input type="number" value={daily} onChange={(event) => setDaily(Number(event.target.value))} /></Field>
            <Field label="权重"><Input type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></Field>
          </div>
          <Field label="运行目录"><Input value={engineHome} onChange={(event) => setEngineHome(event.target.value)} placeholder="留空则自动生成" /></Field>
          <Field label="认证 auth.json"><Textarea value={runnerAuthJson} onChange={(event) => setRunnerAuthJson(event.target.value)} placeholder={modal === "edit" ? "留空保持不变" : '{"auth_mode":"chatgpt","tokens":{...}}'} /></Field>
          <Field label="环境变量 / Token"><Textarea value={envText} onChange={(event) => setEnvText(event.target.value)} placeholder={modal === "edit" ? "留空保持不变；填写后整体替换" : "OPENAI_API_KEY=...\nPROVIDER_TOKEN=..."} /></Field>
          {error && modal ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)}>取消</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ServerCog className="h-4 w-4" />}
              保存
            </Button>
          </div>
        </form>
      </AdminModal>
    </>
  );
}

function SettingsPanel({ settings, onRefresh }: { settings: SettingsData | null; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const corsOrigins = settings?.cors_allowed_origins || [];
  const adminEmails = settings?.admin_allowed_emails || [];
  const adminDomains = settings?.admin_allowed_domains || [];
  const storageReady = Boolean(settings?.storage_provider && settings.storage_provider !== "local" && settings.r2_bucket && settings.r2_public_base_url);

  async function toggleLibraryPublic() {
    if (!settings) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await imagenApi.updateSettings({
        library_public_enabled: !settings.library_public_enabled,
      });
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存系统设置失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SettingStatusTile
          label="素材库"
          value={settings?.library_public_enabled ? "公开" : "关闭"}
          tone={settings?.library_public_enabled ? "green" : "amber"}
          description={settings?.library_public_enabled ? "首页和客户端可访问素材库" : "公开入口和 API 会隐藏素材库"}
        />
        <SettingStatusTile
          label="登录"
          value={settings?.google_configured ? "已配置" : "未配置"}
          tone={settings?.google_configured ? "green" : "red"}
          description={settings?.google_configured ? "Google 授权登录可用" : "需要配置 Google Client"}
        />
        <SettingStatusTile
          label="存储"
          value={settings?.storage_provider || "-"}
          tone={storageReady ? "green" : "amber"}
          description={storageReady ? "对象存储和公开地址已配置" : "检查 Bucket 和公开访问地址"}
        />
        <SettingStatusTile
          label="跨域"
          value={`${corsOrigins.length} 个来源`}
          tone={corsOrigins.length ? "blue" : "amber"}
          description={corsOrigins.length ? "前后端分离访问已放行" : "生产前需要配置允许来源"}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">产品开关</h2>
              <p className="mt-1 text-sm text-surface-400">控制前台能力是否对客户开放。</p>
            </div>
            <Badge tone={settings?.library_public_enabled ? "green" : "amber"}>
              {settings?.library_public_enabled ? "素材库公开" : "素材库关闭"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 rounded-lg border border-white/8 bg-surface-950/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-white">公开素材库</div>
                <div className="mt-1 max-w-3xl text-sm leading-6 text-surface-500">
                  关闭后首页和客户端会隐藏素材库入口，公开素材库 API 返回空列表；已有生成任务和后台管理不受影响。
                </div>
              </div>
              <Button
                className="shrink-0"
                variant={settings?.library_public_enabled ? "secondary" : "primary"}
                disabled={!settings || saving}
                onClick={() => void toggleLibraryPublic()}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {settings?.library_public_enabled ? "关闭公开访问" : "开放素材库"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <SettingsSection title="访问地址" description="前端、后端和浏览器跨域相关配置。">
          <SettingItem label="API 地址" value={settings?.public_base_url || "-"} mono />
          <SettingItem label="前端地址" value={settings?.web_base_url || "-"} mono />
          <SettingItem label="CORS 允许来源" value={<ValueChips values={corsOrigins} mono empty="未设置" />} />
        </SettingsSection>

        <SettingsSection title="登录与权限" description="后台登录白名单和 Google OAuth 回调。">
          <SettingItem label="Google 登录" value={settings?.google_configured ? <Badge tone="green">已配置</Badge> : <Badge tone="red">未配置</Badge>} />
          <SettingItem label="回调地址" value={settings?.google_redirect_url || "-"} mono />
          <SettingItem label="允许邮箱" value={<ValueChips values={adminEmails} mono empty="未限制邮箱" />} />
          <SettingItem label="允许域名" value={<ValueChips values={adminDomains} mono empty="未限制域名" />} />
        </SettingsSection>

        <SettingsSection title="存储概览" description="当前文件落盘方式和公开下载地址。">
          <SettingItem label="存储类型" value={settings?.storage_provider || "-"} />
          <SettingItem label="Bucket" value={settings?.r2_bucket || "-"} mono />
          <SettingItem label="公网地址" value={settings?.r2_public_base_url || "-"} mono />
          <SettingItem label="路径前缀" value={settings?.r2_key_prefix || "-"} mono />
        </SettingsSection>

        <SettingsSection title="R2 凭据" description="这里展示的是后端返回的脱敏配置，用来确认是否读到环境变量。">
          <SettingItem label="R2 账号" value={settings?.r2_account_id || "-"} mono />
          <SettingItem label="R2 Access Key" value={settings?.r2_access_key_id || "-"} mono />
          <SettingItem label="配置状态" value={storageReady ? <Badge tone="green">可用</Badge> : <Badge tone="amber">待确认</Badge>} />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingStatusTile({
  label,
  value,
  tone,
  description,
}: {
  label: string;
  value: string;
  tone: "neutral" | "green" | "amber" | "red" | "blue";
  description: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-surface-900/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-surface-500">{label}</div>
        <Badge tone={tone}>{value}</Badge>
      </div>
      <div className="mt-3 min-h-10 text-sm leading-5 text-surface-300">{description}</div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-surface-400">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-3">{children}</CardContent>
    </Card>
  );
}

function SettingItem({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/6 bg-surface-950/45 px-3 py-3">
      <div className="text-xs text-surface-500">{label}</div>
      <div className={cn("mt-1 min-w-0 break-words text-sm text-surface-200", mono && "font-mono text-xs leading-5")}>{value}</div>
    </div>
  );
}

function ValueChips({ values, empty, mono = false }: { values: string[]; empty: string; mono?: boolean }) {
  if (values.length === 0) {
    return <span className="text-surface-500">{empty}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <span
          key={value}
          className={cn(
            "max-w-full break-all rounded-md border border-white/8 bg-white/5 px-2 py-1 text-xs text-surface-200",
            mono && "font-mono",
          )}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function AdminModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/80 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-white/10 bg-surface-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-white/5 hover:text-white"
            aria-label="关闭"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-65px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-surface-500">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-white/6 bg-surface-950/45 px-3 py-2">
      <span className="shrink-0 text-surface-500">{label}</span>
      <span className="min-w-0 break-all text-right text-surface-200">{value}</span>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-surface-500">
        暂无记录
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border-b border-white/8 px-3 py-2 text-xs font-medium text-surface-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="group">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-white/6 px-3 py-3 align-top text-surface-300 group-hover:bg-white/[0.02]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "active" || status === "succeeded" ? "green" : status === "queued" || status === "running" ? "blue" : status === "failed" || status === "disabled" ? "red" : "neutral";
  return <Badge tone={tone}>{statusLabel(status)}</Badge>;
}

function statusLabel(status: string) {
  return statusLabels[status] || status || "-";
}

function usageText(used: number, limit: number) {
  if (!limit || limit < 0) {
    return `${used} / 不限`;
  }
  return `${used} / ${limit}`;
}

function quotaPercent(used: number, limit: number) {
  if (!limit || limit < 0) {
    return 0;
  }
  return Math.min(100, Math.round((used / limit) * 100));
}

function customerLabel(customer: Customer | undefined, fallback: string) {
  if (!customer) {
    return fallback || "-";
  }
  const name = customer.name || customer.email || customer.id;
  return customer.email && customer.email !== name ? `${name} / ${customer.email}` : name;
}

function formatAdminDate(value: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN");
}

function formatCompactDate(value: string | null) {
  if (!value) {
    return "从未";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseEnv(raw: string) {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
  return env;
}

const selectClassName =
  "h-10 w-full rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none transition focus:border-brand-400/70 focus:ring-2 focus:ring-brand-500/20";
