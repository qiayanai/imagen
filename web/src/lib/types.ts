export type AdminUser = {
  email: string;
  name: string;
  picture: string;
  exp: number;
};

export type MeResponse = {
  authenticated: boolean;
  user: AdminUser | null;
  login_url: string;
  google_configured?: boolean;
};

export type Quota = {
  image_limit_total: number;
  image_used_total: number;
  image_remaining: number;
  image_limit_daily: number;
  image_used_daily: number;
  daily_remaining: number;
  max_concurrency: number;
};

export type Overview = {
  task_counts: Record<string, number>;
  total_tasks: number;
  total_output_images: number;
  api_keys: number;
  provider_accounts: number;
  storage_provider: string;
  storage_ready: boolean;
  storage_public_url: string;
};

export type APIKey = {
  id: string;
  name: string;
  key_prefix: string;
  status: string;
  image_limit_total: number;
  image_used_total: number;
  image_limit_daily: number;
  image_used_daily: number;
  current_day: string;
  max_concurrency: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderAccount = {
  id: string;
  name: string;
  provider: string;
  status: string;
  weight: number;
  max_concurrency: number;
  running_count: number;
  daily_image_limit: number;
  daily_image_used: number;
  current_day: string;
  engine_home: string;
  auth_configured: boolean;
  env_keys: string[];
  last_error: string;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageTask = {
  id: string;
  batch_id: string;
  api_key_id: string;
  provider_account_id: string;
  status: string;
  prompt: string;
  image_count: number;
  output_image_count: number;
  model: string;
  size: string;
  quality: string;
  output_format: string;
  output_urls: string[];
  error: string;
  attempt: number;
  created_at: string;
  queued_at: string;
  finished_at: string | null;
  duration_millis: number;
};

export type Settings = {
  public_base_url: string;
  web_base_url: string;
  cors_allowed_origins: string[];
  storage_provider: string;
  storage_dir: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_bucket: string;
  r2_public_base_url: string;
  r2_key_prefix: string;
  google_configured: boolean;
  google_client_id: string;
  google_redirect_url: string;
  admin_allowed_emails: string[];
  admin_allowed_domains: string[];
};
