"use client";

import { CheckCircle2, Clock3, Code2, KeyRound, ListChecks, Server, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { useLocale, type Locale } from "@/lib/i18n";
import { siteConfig } from "@/lib/site/content";

type DocsCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  baseUrl: string;
  auth: string;
  important: string;
  flowTitle: string;
  createTitle: string;
  createBody: string;
  pollTitle: string;
  pollBody: string;
  resultTitle: string;
  resultBody: string;
  requestParams: string;
  outputParams: string;
  otherEndpoints: string;
  statusAndErrors: string;
  field: string;
  type: string;
  description: string;
};

const copy: Record<Locale, DocsCopy> = {
  en: {
    eyebrow: "API documentation",
    title: "Call the image generation API in three steps.",
    intro: "Create a task, poll the task ID returned by the API, then read image download URLs from `output_urls`.",
    baseUrl: "Base URL",
    auth: "Authentication",
    important: "Keep API keys on your server. Do not expose them in browser JavaScript.",
    flowTitle: "Minimal flow",
    createTitle: "1. Create a task",
    createBody: "Submit the prompt and generation settings. The response contains `task.id`.",
    pollTitle: "2. Poll the task",
    pollBody: "Replace `{task_id}` with the `task.id` returned by the create call, for example `task_9f4a...`.",
    resultTitle: "3. Use the output URLs",
    resultBody: "When `task.status` becomes `succeeded`, read `task.output_urls`. Those are the generated image download links.",
    requestParams: "Request fields",
    outputParams: "Output fields",
    otherEndpoints: "Other endpoints",
    statusAndErrors: "Status and errors",
    field: "Field",
    type: "Type",
    description: "Description",
  },
  zh: {
    eyebrow: "API 文档",
    title: "三步调用生图 API。",
    intro: "先创建任务，拿到返回的任务 ID，再轮询任务状态，最后从 `output_urls` 读取图片下载链接。",
    baseUrl: "接口域名",
    auth: "认证方式",
    important: "API Key 只能放在服务端，不能暴露在浏览器 JavaScript 里。",
    flowTitle: "最小调用流程",
    createTitle: "1. 创建任务",
    createBody: "提交 prompt 和生成参数。接口会返回 `task.id`。",
    pollTitle: "2. 轮询任务",
    pollBody: "把创建任务返回的 `task.id` 替换到 `{task_id}` 里，例如 `task_9f4a...`。",
    resultTitle: "3. 读取图片链接",
    resultBody: "当 `task.status` 变成 `succeeded`，读取 `task.output_urls`，这里就是生成图片的下载链接。",
    requestParams: "请求参数",
    outputParams: "输出参数",
    otherEndpoints: "其它接口",
    statusAndErrors: "状态和错误",
    field: "字段",
    type: "类型",
    description: "说明",
  },
};

const apiBaseUrl = siteConfig.apiBaseUrl;

export default function DocsPage() {
  const [locale] = useLocale();
  const t = copy[locale];
  const isZH = locale === "zh";

  const createTaskCurl = `curl -s ${apiBaseUrl}/v1/tasks \\
  -H "Authorization: Bearer sk_img_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "${isZH ? "一张干净的棚拍产品图，主体是一瓶透明玻璃香水" : "A clean studio product image of a transparent glass perfume bottle"}",
    "image_count": 1,
    "size": "1024x1024",
    "quality": "medium",
    "output_format": "png"
  }'`;

  const createTaskResponse = `{
  "task": {
    "id": "task_9f4a...",
    "status": "queued",
    "image_count": 1,
    "output_urls": []
  },
  "quota": {
    "image_remaining": 988,
    "daily_remaining": 96
  }
}`;

  const pollTaskCurl = `curl -s ${apiBaseUrl}/v1/tasks/{task_id} \\
  -H "Authorization: Bearer sk_img_xxx"`;

  const successResponse = `{
  "task": {
    "id": "task_9f4a...",
    "status": "succeeded",
    "output_image_count": 1,
    "output_urls": [
      "https://cdn.example.com/generated/image.png"
    ],
    "error": ""
  }
}`;

  const requestRows = [
    ["prompt", "string", isZH ? "必填。图片生成提示词。" : "Required. The image generation prompt."],
    ["image_count", "number", isZH ? "可选，默认 1。一次任务生成几张图。" : "Optional, defaults to 1. Number of images to generate."],
    [
      "size",
      "string",
      isZH
        ? "可选，WIDTHxHEIGHT 像素格式，例如 1024x1024、1536x1024、1024x1536。"
        : "Optional WIDTHxHEIGHT pixel size, for example 1024x1024, 1536x1024, or 1024x1536.",
    ],
    ["quality", "string", isZH ? "可选：low、medium、high。" : "Optional: low, medium, high."],
    ["output_format", "string", isZH ? "可选，通常用 png。" : "Optional, usually png."],
  ];

  const outputRows = [
    ["task.id", "string", isZH ? "任务 ID。轮询时把它放到 `{task_id}`。" : "Task ID. Put it into `{task_id}` when polling."],
    ["task.status", "string", isZH ? "queued、running、succeeded、failed、canceled。" : "queued, running, succeeded, failed, canceled."],
    ["task.output_urls", "string[]", isZH ? "生成成功后的图片下载链接。未完成时为空数组。" : "Generated image download URLs. Empty before completion."],
    ["task.output_image_count", "number", isZH ? "实际成功生成的图片数量。" : "Number of images successfully generated."],
    ["task.error", "string", isZH ? "失败原因。失败时查看这个字段。" : "Failure reason. Check this when the task fails."],
    ["quota.image_remaining", "number", isZH ? "当前 API Key 剩余总图片额度。" : "Remaining total image quota for the API key."],
    ["quota.daily_remaining", "number", isZH ? "当前 API Key 今日剩余图片额度。" : "Remaining daily image quota for the API key."],
  ];

  const endpointRows = [
    ["POST", "/v1/tasks", isZH ? "创建单个生成任务。" : "Create one generation task."],
    ["GET", "/v1/tasks/{task_id}", isZH ? "查询单个任务状态和输出。" : "Get one task status and output."],
    ["GET", "/v1/tasks?status=all&page=1&limit=20", isZH ? "查看当前 API Key 的任务列表。" : "List tasks for the current API key."],
    ["GET", "/v1/quota", isZH ? "查询当前 API Key 的额度。" : "Check quota for the current API key."],
    ["POST", "/v1/batches", isZH ? "创建批量任务，body 里传 tasks 数组。" : "Create a batch with a `tasks` array."],
  ];

  return (
    <main className="min-h-screen bg-surface-950 text-surface-200">
      <SiteNav />

      <section className="px-5 pb-10 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold text-mint-400">{t.eyebrow}</p>
          <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.7fr)] lg:items-start">
            <div>
              <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-normal text-white sm:text-6xl">
                {t.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-surface-400">{t.intro}</p>
            </div>
            <div className="grid gap-3">
              <InfoLine icon={Server} label={t.baseUrl} value={apiBaseUrl} />
              <InfoLine icon={KeyRound} label={t.auth} value="Authorization: Bearer sk_img_xxx" />
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
                {t.important}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-surface-900/45 px-5 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white">{t.flowTitle}</h2>
          <div className="mt-6 grid gap-5">
            <Step number="1" icon={Sparkles} title={t.createTitle} body={t.createBody}>
              <CodeBlock code={createTaskCurl} />
              <CodeBlock title={isZH ? "返回示例" : "Example response"} code={createTaskResponse} />
            </Step>
            <Step number="2" icon={Clock3} title={t.pollTitle} body={t.pollBody}>
              <CodeBlock code={pollTaskCurl} />
            </Step>
            <Step number="3" icon={CheckCircle2} title={t.resultTitle} body={t.resultBody}>
              <CodeBlock title={isZH ? "成功返回示例" : "Successful response"} code={successResponse} />
            </Step>
          </div>
        </div>
      </section>

      <section className="px-5 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          <DocPanel title={t.requestParams} icon={Code2}>
            <FieldTable columns={[t.field, t.type, t.description]} rows={requestRows} />
          </DocPanel>
          <DocPanel title={t.outputParams} icon={ListChecks}>
            <FieldTable columns={[t.field, t.type, t.description]} rows={outputRows} />
          </DocPanel>
          <DocPanel title={t.otherEndpoints} icon={Code2} className="lg:col-span-2">
            <EndpointTable rows={endpointRows} />
          </DocPanel>
          <DocPanel title={t.statusAndErrors} icon={ShieldCheck} className="lg:col-span-2">
            <div className="grid gap-3 text-sm leading-6 text-surface-400 md:grid-cols-2">
              <p>
                {isZH
                  ? "`queued` 排队中，`running` 生成中，`succeeded` 已完成，`failed` 失败，`canceled` 已取消。"
                  : "`queued` means waiting, `running` means generating, `succeeded` means complete, `failed` means failed, and `canceled` means canceled."}
              </p>
              <p>
                {isZH
                  ? "错误返回 JSON：`{\"error\":\"...\"}`。常见状态码：400 参数错误，401 Key 无效，404 任务不存在，429/503 额度或容量不可用。"
                  : "Errors return JSON: `{\"error\":\"...\"}`. Common statuses: 400 invalid request, 401 invalid key, 404 task not found, 429/503 quota or capacity unavailable."}
              </p>
            </div>
          </DocPanel>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-surface-900/70 px-4 py-3">
      <Icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-xs text-surface-500">{label}</div>
        <div className="mt-1 break-all font-mono text-sm text-white">{value}</div>
      </div>
    </div>
  );
}

function Step({
  number,
  icon: Icon,
  title,
  body,
  children,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-surface-950/50 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">{number}</span>
          <Icon className="h-5 w-5 text-brand-300" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-surface-400">{body}</p>
      </div>
      <div className="grid min-w-0 gap-3">{children}</div>
    </section>
  );
}

function DocPanel({
  title,
  icon: Icon,
  className = "",
  children,
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-lg border border-white/10 bg-surface-900/70 p-5 shadow-xl shadow-black/15 ${className}`}>
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-5 w-5 text-mint-400" aria-hidden="true" />
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-surface-950">
      {title ? <div className="border-b border-white/10 px-4 py-2 text-xs font-medium text-surface-500">{title}</div> : null}
      <pre className="overflow-x-auto p-4 text-sm leading-7 text-surface-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FieldTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-surface-500">
            {columns.map((column) => (
              <th key={column} className="py-2 pr-3 font-medium">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, type, description]) => (
            <tr key={field} className="border-b border-white/6">
              <td className="py-3 pr-3 font-mono text-xs text-white">{field}</td>
              <td className="py-3 pr-3 font-mono text-xs text-surface-300">{type}</td>
              <td className="py-3 text-surface-400">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <tbody>
          {rows.map(([method, path, description]) => (
            <tr key={`${method}-${path}`} className="border-b border-white/6">
              <td className="w-24 py-3 pr-3">
                <Badge tone={method === "POST" ? "green" : "blue"}>{method}</Badge>
              </td>
              <td className="py-3 pr-3 font-mono text-xs text-white">{path}</td>
              <td className="py-3 text-surface-400">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
