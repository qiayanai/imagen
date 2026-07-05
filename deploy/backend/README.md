# 后端部署

后端需要部署在普通服务器上，因为它要执行配置好的生图 Runner。前端可以单独放在 Cloudflare Pages。

> 推荐生产环境使用仓库根目录的 `deploy/prod.sh` 和 `deploy/compose.prod.yml`。本目录保留的是不使用容器时的 systemd / Nginx 参考。

## 构建

```bash
cd backend
go build -o imagen-api ./cmd/imagegenapi
```

把 `imagen-api` 和后端目录复制到服务器，例如 `/opt/imagen/backend`。

## 运行配置

可以参考 `backend/config/local.env.example` 创建 `/etc/imagen/local.env`。

生产环境至少需要：

```env
IMAGEGEN_ADDR=127.0.0.1:8092
IMAGEGEN_PUBLIC_BASE_URL=https://imagen-api.example.com
IMAGEGEN_WEB_BASE_URL=https://imagen.example.com
IMAGEGEN_CORS_ORIGINS=https://imagen.example.com
IMAGEGEN_SESSION_COOKIE_DOMAIN=.example.com
IMAGEGEN_STORAGE_PROVIDER=r2
IMAGEGEN_RUNNER_PATH=/opt/imagen/backend/bin/imagen-runner
```

Google OAuth 回调地址：

```text
https://imagen-api.example.com/admin/auth/google/callback
```

## systemd

安装服务：

```bash
sudo cp deploy/backend/imagen.service /etc/systemd/system/imagen.service
sudo systemctl daemon-reload
sudo systemctl enable --now imagen
```

使用 Nginx 或 Caddy 做 HTTPS，并反向代理到 `127.0.0.1:8092`。
