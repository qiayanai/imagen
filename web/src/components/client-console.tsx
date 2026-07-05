"use client";

import {
  ArrowUpRight,
  ImageIcon,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { customerApi } from "@/lib/api";
import type { ImageTask, Quota } from "@/lib/types";

const apiKeyStorageKey = "imagen-client-api-key";

const statusLabels: Record<string, string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  canceled: "已取消",
};

export function ClientConsole() {
  const [apiKey, setAPIKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [quota, setQuota] = useState<Quota | null>(null);
  const [tasks, setTasks] = useState<ImageTask[]>([]);
  const [prompt, setPrompt] = useState("一张干净的棚拍产品图，主体是一瓶透明玻璃香水");
  const [imageCount, setImageCount] = useState(1);
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (key = savedKey) => {
    if (!key) {
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const [quotaResult, taskResult] = await Promise.all([
        customerApi.quota(key),
        customerApi.tasks(key),
      ]);
      setQuota(quotaResult.quota);
      setTasks(taskResult.items);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "账号信息加载失败。");
    } finally {
      setLoading(false);
    }
  }, [savedKey]);

  useEffect(() => {
    const existing = window.localStorage.getItem(apiKeyStorageKey) || "";
    if (existing) {
      setAPIKey(existing);
      setSavedKey(existing);
      void refresh(existing);
    }
  }, [refresh]);

  function connect() {
    const key = apiKey.trim();
    window.localStorage.setItem(apiKeyStorageKey, key);
    setSavedKey(key);
    void refresh(key);
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!savedKey) {
      setMessage("请先添加 API 密钥，再创建生成任务。");
      return;
    }
    setCreating(true);
    setMessage("");
    try {
      await customerApi.createTask(savedKey, {
        prompt,
        image_count: imageCount,
        size,
        quality,
        output_format: "png",
      });
      await refresh(savedKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建任务失败。");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1450px]">
        <header className="mb-6 flex flex-col gap-4 border-b border-white/8 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-brand-300">Imagen 客户端</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white">生成图片</h1>
            </div>
          </div>
          <a
            href="/admin/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition hover:bg-white/10"
          >
            管理后台
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </header>

        {message ? (
          <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-white">API 密钥</h2>
                <p className="mt-1 text-sm text-surface-400">粘贴管理员创建的密钥后即可创建任务。</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={apiKey}
                  onChange={(event) => setAPIKey(event.target.value)}
                  placeholder="sk_img_..."
                  type="password"
                />
                <div className="flex gap-2">
                  <Button onClick={connect} className="flex-1">
                    <KeyRound className="h-4 w-4" />
                    连接
                  </Button>
                  <Button variant="secondary" onClick={() => void refresh()} disabled={!savedKey || loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-white">额度</h2>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <QuotaItem label="总用量" value={quota ? usageText(quota.image_used_total, quota.image_limit_total) : "-"} />
                <QuotaItem label="每日用量" value={quota ? usageText(quota.image_used_daily, quota.image_limit_daily) : "-"} />
                <QuotaItem label="剩余额度" value={quota ? quota.image_remaining : "-"} />
                <QuotaItem label="并发数" value={quota ? quota.max_concurrency || "不限" : "-"} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold text-white">新建任务</h2>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={(event) => void createTask(event)}>
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-surface-500">提示词</span>
                    <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label>
                      <span className="mb-1.5 block text-xs font-medium text-surface-500">图片数</span>
                      <Input type="number" min={1} max={10} value={imageCount} onChange={(event) => setImageCount(Number(event.target.value))} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-medium text-surface-500">尺寸</span>
                      <Input value={size} onChange={(event) => setSize(event.target.value)} />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-xs font-medium text-surface-500">质量</span>
                      <select
                        value={quality}
                        onChange={(event) => setQuality(event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-surface-950/70 px-3 text-sm text-white outline-none"
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                    </label>
                  </div>
                  <Button type="submit" disabled={creating || !savedKey}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    创建任务
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">最近任务</h2>
                  <p className="text-sm text-surface-400">刷新后查看任务状态和图片下载链接。</p>
                </div>
                {savedKey ? <Badge tone="green">已连接</Badge> : <Badge tone="amber">等待密钥</Badge>}
              </CardHeader>
              <CardContent>
                <TaskList tasks={tasks} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function QuotaItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/8 bg-surface-950/50 p-4">
      <div className="text-xs text-surface-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function TaskList({ tasks }: { tasks: ImageTask[] }) {
  if (!tasks.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-surface-500">
        暂无任务
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {["状态", "提示词", "图片", "输出", "创建时间"].map((header) => (
              <th key={header} className="border-b border-white/8 px-3 py-2 text-xs font-medium text-surface-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="border-b border-white/6 px-3 py-3"><StatusBadge status={task.status} /></td>
              <td className="border-b border-white/6 px-3 py-3"><span className="line-clamp-2 max-w-[420px]">{task.prompt}</span></td>
              <td className="border-b border-white/6 px-3 py-3">{task.output_image_count} / {task.image_count}</td>
              <td className="border-b border-white/6 px-3 py-3">
                {task.output_urls?.length ? (
                  <a href={task.output_urls[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                    打开 <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : "-"}
              </td>
              <td className="border-b border-white/6 px-3 py-3 text-surface-400">{formatDate(task.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "succeeded" ? "green" : status === "queued" || status === "running" ? "blue" : status === "failed" ? "red" : "neutral";
  return <Badge tone={tone}>{statusLabels[status] || status || "-"}</Badge>;
}

function usageText(used: number, limit: number) {
  if (!limit || limit < 0) {
    return `${used} / 不限`;
  }
  return `${used} / ${limit}`;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
