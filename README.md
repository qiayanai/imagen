# Imagen

Imagen 是一个前后端分离的批量生图服务。前端可以部署到 Cloudflare Pages，后端部署到能运行 Go 和生图 Runner 的服务器，生成结果建议存到 Cloudflare R2。

## 目录结构

- `backend`: Go API 服务，负责 API 密钥、额度、任务队列、引擎账号、图片生成和存储。
- `web`: Next.js 静态前端，包含客户端页面和管理后台，视觉风格参考 KageOS Hub。
- `deploy`: 后端生产部署脚本和 Podman compose 配置。
- `deploy/backend`: 旧版 systemd / Nginx 参考配置。

## 本地启动

启动后端：

```bash
cd backend
cp config/local.env.example config/local.env
go run ./cmd/imagegenapi
```

启动前端：

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

默认地址：

- 后端 API：`http://127.0.0.1:8092`
- 客户端：`http://127.0.0.1:4102/client`
- 管理后台：`http://127.0.0.1:4102/admin`

## 生产部署

后端推荐参考 Hub 的方式部署：服务器上保留仓库，更新时 `git pull`，再执行 `deploy/prod.sh up` 构建并重启容器。

首次初始化配置：

```bash
git clone git@github.com:qiayanai/imagen.git
cd imagen
deploy/prod.sh init-config
```

编辑生成的生产配置，默认路径：

```text
$HOME/services/imagen/config/config.prod.env
```

关键项通常是：

```env
IMAGEGEN_DATABASE_DSN=postgres://imagen:<password>@kageos-hub-postgres:5432/imagen?sslmode=disable
IMAGEGEN_PUBLIC_BASE_URL=https://imagen-api.example.com
IMAGEGEN_WEB_BASE_URL=https://imagen.example.com
IMAGEGEN_CORS_ORIGINS=https://imagen.example.com
IMAGEGEN_SESSION_COOKIE_DOMAIN=.example.com
IMAGEGEN_STORAGE_PROVIDER=r2
IMAGEGEN_STORAGE_DIR=/var/lib/imagen/storage
IMAGEGEN_ENGINE_HOME_DIR=/var/lib/imagen/engines
IMAGEGEN_WORKDIR=/var/lib/imagen/work
IMAGEGEN_RUNNER_PATH=/app/bin/imagen-runner
IMAGEGEN_LOG_FILE=/var/log/imagen/imagen-api.log
GOOGLE_REDIRECT_URL=https://imagen-api.example.com/admin/auth/google/callback
```

启动或更新：

```bash
git pull
deploy/prod.sh up
```

常用命令：

```bash
deploy/prod.sh logs          # 追踪落盘应用日志
deploy/prod.sh compose-logs  # 追踪容器 stdout/stderr
deploy/prod.sh ps
deploy/prod.sh restart
deploy/prod.sh config
deploy/prod.sh down
```

默认持久化目录：

```text
$HOME/services/imagen/data  -> /var/lib/imagen
$HOME/services/imagen/logs  -> /var/log/imagen
```

Imagen 容器会加入外部 Podman 网络 `kageos-hub-net`，因此可以用 `kageos-hub-postgres:5432` 访问现有 PG 实例。

## 前端部署

- `web` 部署到 Cloudflare Pages。
- `backend` 部署到韩国服务器，由它负责执行生图 Runner。
- 生成图片上传到 Cloudflare R2，接口返回可下载的公网地址。

推荐域名形态：

```text
https://imagen.example.com      -> Cloudflare Pages web
https://imagen-api.example.com  -> Korea server backend
https://cdn.imagen.chat         -> Cloudflare R2 public bucket/domain
```

不要提交 `backend/config/local.env`、`config.prod.env`、SQLite 数据库文件或生成图片目录。

## 验证

```bash
cd backend && go test ./...
cd ../web && npm run lint && npm run build
```
