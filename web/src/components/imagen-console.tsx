"use client";

import {
  Activity,
  HardDrive,
  ImageIcon,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ServerCog,
  Settings,
  UsersRound,
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
  ImageTask,
  Overview,
  ProviderAccount,
  Settings as SettingsData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "overview" | "keys" | "tasks" | "accounts" | "settings";

type LoadState = {
  user: AdminUser | null;
  overview: Overview | null;
  keys: APIKey[];
  tasks: ImageTask[];
  taskTotal: number;
  accounts: ProviderAccount[];
  settings: SettingsData | null;
};

const navItems: Array<{ id: View; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "总览", icon: Activity },
  { id: "keys", label: "API 密钥", icon: KeyRound },
  { id: "tasks", label: "生成任务", icon: ImageIcon },
  { id: "accounts", label: "引擎账号", icon: UsersRound },
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

const emptyState: LoadState = {
  user: null,
  overview: null,
  keys: [],
  tasks: [],
  taskTotal: 0,
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
      const [overview, keys, tasks, accounts, settings] = await Promise.all([
        imagenApi.overview(),
        imagenApi.apiKeys(),
        imagenApi.tasks(),
        imagenApi.providerAccounts(),
        imagenApi.settings(),
      ]);
      setState({
        user: me.user,
        overview,
        keys: keys.items,
        tasks: tasks.items,
        taskTotal: tasks.total,
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

  const activeTitle = useMemo(() => navItems.find((item) => item.id === view)?.label || "总览", [view]);

  async function logout() {
    await imagenApi.logout();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
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
              <a
                href="/client/"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/10"
              >
                客户端
              </a>
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
              {view === "keys" ? <KeysPanel keys={state.keys} onCreated={setNewKey} onRefresh={load} newKey={newKey} /> : null}
              {view === "tasks" ? <TasksPanel tasks={state.tasks} total={state.taskTotal} /> : null}
              {view === "accounts" ? <AccountsPanel accounts={state.accounts} onRefresh={load} /> : null}
              {view === "settings" ? <SettingsPanel settings={state.settings} /> : null}
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric title="总任务数" value={overview?.total_tasks || 0} icon={ImageIcon} />
        <Metric title="产出图片" value={overview?.total_output_images || 0} icon={HardDrive} />
        <Metric title="API 密钥" value={overview?.api_keys || 0} icon={KeyRound} />
        <Metric title="引擎账号" value={overview?.provider_accounts || 0} icon={ServerCog} />
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

function KeysPanel({
  keys,
  onCreated,
  onRefresh,
  newKey,
}: {
  keys: APIKey[];
  onCreated: (key: string) => void;
  onRefresh: () => Promise<void>;
  newKey: string;
}) {
  const [name, setName] = useState("客户 A");
  const [total, setTotal] = useState(1000);
  const [daily, setDaily] = useState(100);
  const [concurrency, setConcurrency] = useState(20);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busyID, setBusyID] = useState("");

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await imagenApi.createAPIKey({
        name,
        image_limit_total: total,
        image_limit_daily: daily,
        max_concurrency: concurrency,
      });
      onCreated(result.api_key);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建 API 密钥失败。");
    } finally {
      setSaving(false);
    }
  }

  async function toggleKey(key: APIKey) {
    setBusyID(key.id);
    setError("");
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

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">创建 API 密钥</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => void createKey(event)}>
            <Field label="名称"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="总图片额度"><Input type="number" value={total} onChange={(event) => setTotal(Number(event.target.value))} /></Field>
            <Field label="每日额度"><Input type="number" value={daily} onChange={(event) => setDaily(Number(event.target.value))} /></Field>
            <Field label="并发数"><Input type="number" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></Field>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              创建密钥
            </Button>
          </form>
          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
          {newKey ? (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="text-xs font-medium text-emerald-200">新密钥</div>
              <div className="mt-2 break-all font-mono text-xs text-emerald-50">{newKey}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">密钥列表</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["名称", "前缀", "状态", "总用量", "每日用量", "并发", "操作"]}
            rows={keys.map((key) => [
              key.name || "-",
              key.key_prefix,
              <StatusBadge key={key.id} status={key.status} />,
              usageText(key.image_used_total, key.image_limit_total),
              usageText(key.image_used_daily, key.image_limit_daily),
              key.max_concurrency || "-",
              <Button
                key={key.id}
                variant="secondary"
                className="h-8 px-3"
                disabled={busyID === key.id}
                onClick={() => void toggleKey(key)}
              >
                {busyID === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {key.status === "active" ? "停用" : "启用"}
              </Button>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TasksPanel({ tasks, total }: { tasks: ImageTask[]; total: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">任务列表</h2>
          <p className="text-sm text-surface-400">共 {total} 个任务</p>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          headers={["状态", "提示词", "图片", "耗时", "输出", "错误"]}
          rows={tasks.map((task) => [
            <StatusBadge key={task.id} status={task.status} />,
            <span key={task.id} className="line-clamp-2 max-w-[420px] text-surface-200">{task.prompt}</span>,
            `${task.output_image_count} / ${task.image_count}`,
            task.duration_millis ? `${Math.round(task.duration_millis / 1000)}s` : "-",
            task.output_urls?.length ? (
              <a className="text-sky-300 hover:text-sky-200" href={task.output_urls[0]} target="_blank" rel="noreferrer">
                打开
              </a>
            ) : "-",
            task.error ? <span className="line-clamp-2 max-w-[280px] text-rose-200">{task.error}</span> : "-",
          ])}
        />
      </CardContent>
    </Card>
  );
}

function AccountsPanel({ accounts, onRefresh }: { accounts: ProviderAccount[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState("引擎账号 1");
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

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
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
      setEnvText("");
      setRunnerAuthJson("");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加引擎账号失败。");
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

  return (
    <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">添加引擎账号</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(event) => void createAccount(event)}>
            <Field label="名称"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
            <Field label="状态">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClassName}>
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="并发"><Input type="number" value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></Field>
              <Field label="每日"><Input type="number" value={daily} onChange={(event) => setDaily(Number(event.target.value))} /></Field>
              <Field label="权重"><Input type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></Field>
            </div>
            <Field label="运行目录"><Input value={engineHome} onChange={(event) => setEngineHome(event.target.value)} placeholder="留空则自动生成" /></Field>
            <Field label="认证 auth.json"><Textarea value={runnerAuthJson} onChange={(event) => setRunnerAuthJson(event.target.value)} placeholder={'{"auth_mode":"chatgpt","tokens":{...}}'} /></Field>
            <Field label="环境变量 / Token"><Textarea value={envText} onChange={(event) => setEnvText(event.target.value)} placeholder={"OPENAI_API_KEY=...\nPROVIDER_TOKEN=..."} /></Field>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ServerCog className="h-4 w-4" />}
              添加引擎
            </Button>
          </form>
          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">引擎账号</h2>
        </CardHeader>
        <CardContent>
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
              <Button
                key={account.id}
                variant="secondary"
                className="h-8 px-3"
                disabled={busyID === account.id}
                onClick={() => void toggleAccount(account)}
              >
                {busyID === account.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {account.status === "active" ? "停用" : "启用"}
              </Button>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPanel({ settings }: { settings: SettingsData | null }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">运行配置</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="API 地址" value={settings?.public_base_url || "-"} />
          <Row label="前端地址" value={settings?.web_base_url || "-"} />
          <Row label="CORS" value={settings?.cors_allowed_origins?.join(", ") || "-"} />
          <Row label="Google 登录" value={settings?.google_configured ? "已配置" : "未配置"} />
          <Row label="回调地址" value={settings?.google_redirect_url || "-"} />
          <Row label="允许邮箱" value={settings?.admin_allowed_emails?.join(", ") || "-"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-white">存储配置</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="存储类型" value={settings?.storage_provider || "-"} />
          <Row label="R2 账号" value={settings?.r2_account_id || "-"} />
          <Row label="R2 Key" value={settings?.r2_access_key_id || "-"} />
          <Row label="Bucket" value={settings?.r2_bucket || "-"} />
          <Row label="公网地址" value={settings?.r2_public_base_url || "-"} />
          <Row label="路径前缀" value={settings?.r2_key_prefix || "-"} />
        </CardContent>
      </Card>
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
