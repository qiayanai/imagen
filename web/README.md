# Imagen Web

Imagen 的静态 Next.js 前端，包含客户端页面和管理后台。构建产物可以直接部署到 Cloudflare Pages。

## 本地启动

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开 `http://127.0.0.1:4102`。

主要页面：

- `/client`: 客户端页面，使用 API 密钥创建任务并轮询结果。
- `/admin`: 管理后台，使用 Google 登录后管理密钥、引擎账号、任务和系统配置。

## 构建

```bash
npm run build
```

静态产物会输出到 `out/`。

## Cloudflare Pages

推荐配置：

- 构建命令：`npm run build`
- 输出目录：`out`
- 根目录：`web`
- 环境变量：`NEXT_PUBLIC_IMAGEN_API_URL=https://imagen-api.example.com`

后端需要在 `IMAGEGEN_CORS_ORIGINS` 中允许 Cloudflare Pages 的访问域名。
