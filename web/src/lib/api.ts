import type {
  APIKey,
  ImageTask,
  MeResponse,
  Overview,
  ProviderAccount,
  Quota,
  Settings,
} from "@/lib/types";

export const apiBaseUrl = (
  process.env.NEXT_PUBLIC_IMAGEN_API_URL || "http://127.0.0.1:8092"
).replace(/\/+$/, "");

type RequestOptions = RequestInit & {
  fallbackMessage?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { fallbackMessage = "请求失败", ...init } = options;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || data?.msg || fallbackMessage);
  }
  return data as T;
}

async function customerRequest<T>(path: string, apiKey: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  return request<T>(path, { ...options, headers });
}

export const imagenApi = {
  me: () => request<MeResponse>("/v1/admin/me"),
  overview: () => request<Overview>("/v1/admin/overview"),
  settings: () => request<Settings>("/v1/admin/settings"),
  logout: () => request<{ ok: boolean }>("/v1/admin/logout", { method: "POST" }),
  apiKeys: () => request<{ items: APIKey[] }>("/v1/admin/api-keys"),
  createAPIKey: (payload: {
    name: string;
    image_limit_total: number;
    image_limit_daily: number;
    max_concurrency: number;
  }) =>
    request<{ api_key: string; key: APIKey }>("/v1/admin/api-keys", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAPIKey: (id: string, payload: Partial<{
    name: string;
    status: string;
    image_limit_total: number;
    image_limit_daily: number;
    max_concurrency: number;
  }>) =>
    request<{ key: APIKey }>(`/v1/admin/api-keys/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  tasks: (status = "all") =>
    request<{ items: ImageTask[]; total: number; limit: number; offset: number }>(
      `/v1/admin/tasks?status=${encodeURIComponent(status)}`,
    ),
  providerAccounts: () => request<{ items: ProviderAccount[] }>("/v1/admin/provider-accounts"),
  createProviderAccount: (payload: {
    name: string;
    status: string;
    max_concurrency: number;
    daily_image_limit: number;
    weight: number;
    engine_home: string;
    env: Record<string, string>;
    runner_auth_json: string;
  }) =>
    request<{ account: ProviderAccount }>("/v1/admin/provider-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProviderAccount: (id: string, payload: Partial<{
    name: string;
    status: string;
    max_concurrency: number;
    daily_image_limit: number;
    weight: number;
    engine_home: string;
    env: Record<string, string>;
    replace_env: boolean;
    runner_auth_json: string;
  }>) =>
    request<{ account: ProviderAccount }>(`/v1/admin/provider-accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

export const customerApi = {
  quota: (apiKey: string) => customerRequest<{ quota: Quota }>("/v1/quota", apiKey),
  tasks: (apiKey: string) =>
    customerRequest<{ items: ImageTask[]; total: number; limit: number; offset: number }>("/v1/tasks", apiKey),
  createTask: (
    apiKey: string,
    payload: {
      prompt: string;
      image_count: number;
      size: string;
      quality: string;
      output_format: string;
    },
  ) =>
    customerRequest<{ task: ImageTask; quota: Quota }>("/v1/tasks", apiKey, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export function googleLoginURL(returnTo = "/admin") {
  const target = typeof window === "undefined" ? returnTo : new URL(returnTo, window.location.origin).toString();
  return `${apiBaseUrl}/admin/auth/google?return_to=${encodeURIComponent(target)}`;
}
