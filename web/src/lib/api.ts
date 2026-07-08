import type {
  APIKey,
  ClientSessionResponse,
  Customer,
  ImageTask,
  LibraryAsset,
  LibraryCategory,
  MeResponse,
  Overview,
  ProviderAccount,
  PublicSettings,
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
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new Error(fallbackMessage);
  }
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

async function clientPortalRequest<T>(path: string, portalToken = "", options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (portalToken) {
    headers.set("Authorization", `Bearer ${portalToken}`);
  }
  return request<T>(path, { ...options, headers });
}

export const imagenApi = {
  me: () => request<MeResponse>("/v1/admin/me"),
  overview: () => request<Overview>("/v1/admin/overview"),
  settings: () => request<Settings>("/v1/admin/settings"),
  updateSettings: (payload: Partial<Pick<Settings, "library_public_enabled">>) =>
    request<Settings>("/v1/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ ok: boolean }>("/v1/admin/logout", { method: "POST" }),
  customers: () => request<{ items: Customer[] }>("/v1/admin/customers"),
  createCustomer: (payload: {
    name: string;
    email: string;
    status: string;
    default_image_limit_total: number;
    default_image_limit_daily: number;
    default_max_concurrency: number;
  }) =>
    request<{ customer: Customer; portal_key: string }>("/v1/admin/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCustomer: (id: string, payload: Partial<{
    name: string;
    email: string;
    status: string;
    default_image_limit_total: number;
    default_image_limit_daily: number;
    default_max_concurrency: number;
  }>) =>
    request<{ customer: Customer }>(`/v1/admin/customers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteCustomer: (id: string) =>
    request<{ ok: boolean }>(`/v1/admin/customers/${encodeURIComponent(id)}`, {
      method: "DELETE",
      fallbackMessage: "删除客户失败",
    }),
  apiKeys: () => request<{ items: APIKey[] }>("/v1/admin/api-keys"),
  createAPIKey: (payload: {
    name: string;
    customer_id?: string;
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
  deleteAPIKey: (id: string) =>
    request<{ ok: boolean }>(`/v1/admin/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      fallbackMessage: "删除 API Key 失败",
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
  deleteProviderAccount: (id: string) =>
    request<{ ok: boolean }>(`/v1/admin/provider-accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      fallbackMessage: "删除引擎账号失败",
    }),
  libraryAssets: (params: { q?: string; featured?: boolean; page?: number; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.q) {
      search.set("q", params.q);
    }
    if (typeof params.featured === "boolean") {
      search.set("featured", String(params.featured));
    }
    if (params.page) {
      search.set("page", String(params.page));
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    const suffix = search.toString();
    return request<{ items: LibraryAsset[]; total: number; limit: number; offset: number }>(
      `/v1/admin/library-assets${suffix ? `?${suffix}` : ""}`,
    );
  },
  updateLibraryAsset: (id: string, payload: Partial<{ featured: boolean }>) =>
    request<{ asset: LibraryAsset }>(`/v1/admin/library-assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

export const libraryApi = {
  settings: () => request<PublicSettings>("/v1/public/settings"),
  assets: (params: { category?: string; q?: string; featured?: boolean; page?: number; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.category) {
      search.set("category", params.category);
    }
    if (params.q) {
      search.set("q", params.q);
    }
    if (typeof params.featured === "boolean") {
      search.set("featured", String(params.featured));
    }
    if (params.page) {
      search.set("page", String(params.page));
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    const suffix = search.toString();
    return request<{ items: LibraryAsset[]; total: number; limit: number; offset: number }>(
      `/v1/library/assets${suffix ? `?${suffix}` : ""}`,
    );
  },
  categories: () => request<{ items: LibraryCategory[] }>("/v1/library/categories"),
};

export const clientPortalApi = {
  session: () => request<ClientSessionResponse>("/v1/client/session"),
  logout: () => request<{ ok: boolean }>("/v1/client/logout", { method: "POST" }),
  me: (portalToken = "") => clientPortalRequest<{ customer: Customer }>("/v1/client/me", portalToken),
  apiKeys: (portalToken = "") => clientPortalRequest<{ items: APIKey[] }>("/v1/client/api-keys", portalToken),
  createAPIKey: (payload: { name: string }, portalToken = "") =>
    clientPortalRequest<{ api_key: string; key: APIKey }>("/v1/client/api-keys", portalToken, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAPIKey: (id: string, payload: Partial<{ name: string; status: string }>, portalToken = "") =>
    clientPortalRequest<{ key: APIKey }>(`/v1/client/api-keys/${encodeURIComponent(id)}`, portalToken, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteAPIKey: (id: string, portalToken = "") =>
    clientPortalRequest<{ ok: boolean }>(`/v1/client/api-keys/${encodeURIComponent(id)}`, portalToken, {
      method: "DELETE",
      fallbackMessage: "删除 API Key 失败",
    }),
  quota: (keyID: string, portalToken = "") =>
    clientPortalRequest<{ quota: Quota; key: APIKey }>(`/v1/client/api-keys/${encodeURIComponent(keyID)}/quota`, portalToken),
  tasks: (keyID: string, portalToken = "") =>
    clientPortalRequest<{ items: ImageTask[]; total: number; limit: number; offset: number }>(
      `/v1/client/api-keys/${encodeURIComponent(keyID)}/tasks`,
      portalToken,
    ),
  createTask: (
    keyID: string,
    payload: {
      prompt: string;
      image_count: number;
      size: string;
      quality: string;
      output_format: string;
    },
    portalToken = "",
  ) =>
    clientPortalRequest<{ task: ImageTask; quota: Quota }>(
      `/v1/client/api-keys/${encodeURIComponent(keyID)}/tasks`,
      portalToken,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
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
