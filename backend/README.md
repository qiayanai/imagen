# Imagen Backend

独立的批量生图任务服务。它通过可配置的生图 Runner 执行任务，负责 API 密钥、额度控制、任务队列、多账号调度、图片存储和后台登录。

## 能力

- API 密钥管理，支持总图片额度、每日额度和并发数。
- 创建单个生图任务或批量任务。
- 通过任务 ID 轮询状态，任务成功后返回图片下载链接。
- 支持本地存储和 Cloudflare R2。
- 管理后台支持 Google OAuth 登录。
- 引擎账号支持隔离运行目录、环境变量、并发限制、每日图片限制、权重和冷却。
- 后台 worker 自动消费队列。

## 架构

代码按轻量三层模型组织：

- `internal/httpapi`: HTTP 接入层，负责路由、鉴权、中间件、请求解析和响应 DTO。
- `internal/service`: 应用服务层，负责额度、任务创建、账号选择、生成编排和存储协调。
- `internal/repository`: 数据访问层，负责事务、队列领取、额度预留和统计查询。

基础设施适配器放在三层之外：

- `internal/runner`: 生图 Runner 适配器。
- `internal/storage`: 本地文件和 Cloudflare R2 存储。
- `internal/secret`: 引擎账号环境变量加密。
- `internal/config`: 环境变量配置。

依赖方向保持为 `httpapi -> service -> repository/domain`。HTTP handler 不应该直接引入 GORM 或写数据库查询。

## 本地启动

```bash
cp config/local.env.example config/local.env
go run ./cmd/imagegenapi
```

健康检查：

```bash
curl http://127.0.0.1:8092/healthz
```

主前端在：

```text
http://127.0.0.1:4102/client
http://127.0.0.1:4102/admin
```

后端自带的 `/admin` HTML 页面只是兜底入口，主后台使用 `../web` 里的 Next.js 前端。

## Google 登录

管理后台使用 Google OAuth：

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URL=http://127.0.0.1:8092/admin/auth/google/callback
ADMIN_ALLOWED_EMAILS=admin@example.com
```

Google Cloud Console 中配置的 redirect URI 必须和 `GOOGLE_REDIRECT_URL` 完全一致。

环境变量和 Token 会加密入库，建议生产环境配置一个独立长密钥：

```env
IMAGEGEN_SECRET_KEY=use-a-long-random-secret
```

## R2 存储

生产环境建议使用 Cloudflare R2：

```env
IMAGEGEN_STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_BASE_URL=https://img.example.com
R2_KEY_PREFIX=imagegen/
```

上传后的对象路径类似：

```text
imagegen/tasks/{task_id}/{filename}.png
```

任务返回的 `output_urls` 会使用 `R2_PUBLIC_BASE_URL` 拼出公网下载链接。

## 管理鉴权

浏览器管理接口使用 Google 登录后的签名 Cookie。自动化脚本也可以使用管理 Token：

```text
Authorization: Bearer $IMAGEGEN_ADMIN_TOKEN
```

## 创建 API 密钥

```bash
curl -s http://127.0.0.1:8092/v1/admin/api-keys \
  -H 'Authorization: Bearer change-me-admin-token' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "customer-a",
    "image_limit_total": 1000,
    "image_limit_daily": 100,
    "max_concurrency": 20
  }'
```

返回里的明文 `api_key` 只出现一次，需要调用方自己保存。

## 创建任务

```bash
curl -s http://127.0.0.1:8092/v1/tasks \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "一张干净的棚拍产品图，主体是白色陶瓷咖啡杯",
    "image_count": 1,
    "size": "1024x1024",
    "quality": "high",
    "output_format": "png"
  }'
```

响应里会返回 `task.id`。之后轮询：

```bash
curl -s http://127.0.0.1:8092/v1/tasks/$TASK_ID \
  -H "Authorization: Bearer $API_KEY"
```

当 `status` 变成 `succeeded` 后，从 `output_urls` 获取图片下载链接。

`size` 使用 `WIDTHxHEIGHT` 像素格式，例如 `1024x1024`、`1536x1024`、`1024x1536`、`1024x1280`、`1280x1024`、`1920x1080`、`1080x1920`。不传时默认 `1024x1024`。

## 创建批量任务

```bash
curl -s http://127.0.0.1:8092/v1/batches \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "size": "1024x1024",
    "quality": "medium",
    "tasks": [
      {"prompt": "一张极简风格的生图工具海报", "image_count": 1},
      {"prompt": "一个小型设计工作室的电影感首图", "image_count": 2}
    ]
  }'
```

## 查询额度

```bash
curl -s http://127.0.0.1:8092/v1/quota \
  -H "Authorization: Bearer $API_KEY"
```

额度在任务被接受时预留，避免 worker 延迟时调用方继续超额提交。

## 引擎账号

服务首次启动会创建一个默认引擎账号。需要多账号或负载均衡时，可以在管理后台添加账号，也可以调用 API：

```bash
curl -s http://127.0.0.1:8092/v1/admin/provider-accounts \
  -H 'Authorization: Bearer change-me-admin-token' \
  -H 'Content-Type: application/json' \
  -d '{
	    "name": "engine-account-1",
	    "provider": "default",
	    "max_concurrency": 2,
	    "daily_image_limit": 500,
	    "engine_home": "/srv/imagen/engine-1",
	    "runner_auth_json": "{\"auth_mode\":\"chatgpt\",\"tokens\":{...}}",
	    "env": {
	      "OPENAI_API_KEY": "optional-key-or-account-specific-env"
	    }
	  }'
```

调度器会从启用账号中选择未冷却、并发未满、每日额度足够的账号，并按 `weight` 加权随机分配。

如果提交 `runner_auth_json`，服务会写入 `$engine_home/auth.json`，文件权限为 `0600`。如果 `engine_home` 留空，服务会在 `IMAGEGEN_ENGINE_HOME_DIR` 下自动创建独立目录。

引擎账号的 `env` 会加密存储，后台只展示变量名，不回显明文。
