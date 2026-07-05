# Imagen

Imagen 是一个前后端分离的批量生图服务。前端可以部署到 Cloudflare Pages，后端部署到能运行 Go 和生图 Runner 的服务器，生成结果建议存到 Cloudflare R2。

## 目录结构

- `backend`: Go API 服务，负责 API 密钥、额度、任务队列、引擎账号、图片生成和存储。
- `web`: Next.js 静态前端，包含客户端页面和管理后台，视觉风格参考 KageOS Hub。
- `deploy/backend`: 后端部署参考，包括 systemd 和 Nginx 配置样例。

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

## 部署方式

- `web` 部署到 Cloudflare Pages。
- `backend` 部署到韩国服务器，由它负责执行生图 Runner。
- 生成图片上传到 Cloudflare R2，接口返回可下载的公网地址。

推荐域名形态：

```text
https://imagen.example.com      -> Cloudflare Pages web
https://imagen-api.example.com  -> Korea server backend
https://cdn.imagen.chat         -> Cloudflare R2 public bucket/domain
```

生产环境后端至少需要配置：

```env
IMAGEGEN_PUBLIC_BASE_URL=https://imagen-api.example.com
IMAGEGEN_WEB_BASE_URL=https://imagen.example.com
IMAGEGEN_CORS_ORIGINS=https://imagen.example.com
IMAGEGEN_SESSION_COOKIE_DOMAIN=.example.com
GOOGLE_REDIRECT_URL=https://imagen-api.example.com/admin/auth/google/callback
```

不要提交 `backend/config/local.env`、SQLite 数据库文件或生成图片目录。

## 验证

```bash
cd backend && go test ./...
cd ../web && npm run lint && npm run build
```
