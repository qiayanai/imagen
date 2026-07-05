package httpapi

import (
	"bytes"
	"encoding/json"
	"html/template"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"imagen/backend/internal/domain"
	"imagen/backend/internal/service"
)

type adminLayoutData struct {
	Title   string
	Active  string
	Session adminSession
	Content template.HTML
}

func (a *API) adminDashboard(c *gin.Context) {
	overview, err := a.app.AdminOverview(c.Request.Context())
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	content := renderPartial(dashboardTemplate, overview)
	renderAdminPage(c, "总览", "dashboard", currentAdminSession(c), content)
}

func (a *API) adminAPIKeysPage(c *gin.Context) {
	a.renderAPIKeysPage(c, "")
}

func (a *API) adminCreateAPIKeyForm(c *gin.Context) {
	key, plain, err := a.app.CreateAPIKey(c.Request.Context(), service.CreateAPIKeyInput{
		Name:            c.PostForm("name"),
		ImageLimitTotal: formInt(c, "image_limit_total", 0),
		ImageLimitDaily: formInt(c, "image_limit_daily", 0),
		MaxConcurrency:  formInt(c, "max_concurrency", 0),
	})
	if err != nil {
		a.renderAPIKeysPage(c, err.Error())
		return
	}
	a.renderAPIKeysPage(c, "新 API 密钥："+plain+" ("+key.ID+")")
}

func (a *API) adminUpdateAPIKeyForm(c *gin.Context) {
	status := c.PostForm("status")
	name := c.PostForm("name")
	total := formInt(c, "image_limit_total", 0)
	daily := formInt(c, "image_limit_daily", 0)
	concurrency := formInt(c, "max_concurrency", 0)
	_, err := a.app.UpdateAPIKey(c.Request.Context(), c.Param("id"), service.UpdateAPIKeyInput{
		Name:            &name,
		Status:          &status,
		ImageLimitTotal: &total,
		ImageLimitDaily: &daily,
		MaxConcurrency:  &concurrency,
	})
	if err != nil {
		a.renderAPIKeysPage(c, err.Error())
		return
	}
	c.Redirect(http.StatusFound, "/admin/api-keys")
}

func (a *API) renderAPIKeysPage(c *gin.Context, message string) {
	keys, err := a.app.ListAPIKeys(c.Request.Context())
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	content := renderPartial(apiKeysTemplate, struct {
		Message string
		Keys    []domain.APIKey
	}{Message: message, Keys: keys})
	renderAdminPage(c, "API 密钥", "api-keys", currentAdminSession(c), content)
}

func (a *API) adminTasksPage(c *gin.Context) {
	limit, offset := limitOffset(c)
	if limit > 100 {
		limit = 100
	}
	tasks, total, err := a.app.AdminListTasks(c.Request.Context(), c.Query("status"), limit, offset)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	content := renderPartial(tasksTemplate, struct {
		Tasks  []domain.ImageTask
		Total  int64
		Status string
	}{Tasks: tasks, Total: total, Status: c.Query("status")})
	renderAdminPage(c, "生成任务", "tasks", currentAdminSession(c), content)
}

func (a *API) adminProviderAccountsPage(c *gin.Context) {
	a.renderProviderAccountsPage(c, "")
}

func (a *API) adminCreateProviderAccountForm(c *gin.Context) {
	_, err := a.app.CreateProviderAccount(c.Request.Context(), service.CreateProviderAccountInput{
		Name:            c.PostForm("name"),
		Provider:        firstNonEmpty(c.PostForm("provider"), "default"),
		Status:          firstNonEmpty(c.PostForm("status"), domain.AccountActive),
		Weight:          formInt(c, "weight", 100),
		MaxConcurrency:  formInt(c, "max_concurrency", 1),
		DailyImageLimit: formInt(c, "daily_image_limit", 0),
		EngineHome:      c.PostForm("engine_home"),
		Env:             parseEnvLines(c.PostForm("env_text")),
		RunnerAuthJSON:  c.PostForm("runner_auth_json"),
	})
	if err != nil {
		a.renderProviderAccountsPage(c, err.Error())
		return
	}
	c.Redirect(http.StatusFound, "/admin/provider-accounts")
}

func (a *API) adminUpdateProviderAccountForm(c *gin.Context) {
	name := c.PostForm("name")
	status := c.PostForm("status")
	weight := formInt(c, "weight", 100)
	concurrency := formInt(c, "max_concurrency", 1)
	daily := formInt(c, "daily_image_limit", 0)
	engineHome := c.PostForm("engine_home")
	replaceEnv := c.PostForm("replace_env") == "1"
	_, err := a.app.UpdateProviderAccount(c.Request.Context(), c.Param("id"), service.UpdateProviderAccountInput{
		Name:            &name,
		Status:          &status,
		Weight:          &weight,
		MaxConcurrency:  &concurrency,
		DailyImageLimit: &daily,
		EngineHome:      &engineHome,
		Env:             parseEnvLines(c.PostForm("env_text")),
		ReplaceEnv:      replaceEnv,
		RunnerAuthJSON:  c.PostForm("runner_auth_json"),
	})
	if err != nil {
		a.renderProviderAccountsPage(c, err.Error())
		return
	}
	c.Redirect(http.StatusFound, "/admin/provider-accounts")
}

func (a *API) renderProviderAccountsPage(c *gin.Context, message string) {
	accounts, err := a.app.ListProviderAccounts(c.Request.Context())
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	content := renderPartial(providerAccountsTemplate, struct {
		Message  string
		Accounts []domain.ProviderAccount
	}{Message: message, Accounts: accounts})
	renderAdminPage(c, "引擎账号", "provider-accounts", currentAdminSession(c), content)
}

func (a *API) adminSettingsPage(c *gin.Context) {
	content := renderPartial(settingsTemplate, struct {
		StorageProvider string
		PublicBaseURL   string
		StorageDir      string
		R2AccountID     string
		R2AccessKeyID   string
		R2Bucket        string
		R2PublicBaseURL string
		R2KeyPrefix     string
		GoogleClientID  string
		GoogleRedirect  string
		AllowedEmails   []string
		AllowedDomains  []string
	}{
		StorageProvider: a.app.Config.StorageProvider,
		PublicBaseURL:   a.app.Config.PublicBaseURL,
		StorageDir:      a.app.Config.StorageDir,
		R2AccountID:     mask(a.app.Config.R2AccountID),
		R2AccessKeyID:   mask(a.app.Config.R2AccessKeyID),
		R2Bucket:        a.app.Config.R2Bucket,
		R2PublicBaseURL: a.app.Config.R2PublicBaseURL,
		R2KeyPrefix:     a.app.Config.R2KeyPrefix,
		GoogleClientID:  mask(a.app.Config.GoogleClientID),
		GoogleRedirect:  firstNonEmpty(a.app.Config.GoogleRedirectURL, a.app.Config.PublicBaseURL+"/admin/auth/google/callback"),
		AllowedEmails:   a.app.Config.AdminAllowedEmails,
		AllowedDomains:  a.app.Config.AdminAllowedDomains,
	})
	renderAdminPage(c, "系统设置", "settings", currentAdminSession(c), content)
}

func renderAdminLogin(c *gin.Context, googleConfigured bool, errText string) {
	content := renderPartial(loginTemplate, struct {
		GoogleConfigured bool
		Error            string
	}{GoogleConfigured: googleConfigured, Error: errText})
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(content))
}

func renderAdminPage(c *gin.Context, title, active string, session adminSession, content template.HTML) {
	html := renderPartial(layoutTemplate, adminLayoutData{
		Title:   title,
		Active:  active,
		Session: session,
		Content: content,
	})
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}

func renderPartial(source string, data any) template.HTML {
	tmpl := template.Must(template.New("partial").Funcs(template.FuncMap{
		"active": func(active, key string) string {
			if active == key {
				return "active"
			}
			return ""
		},
		"jsonStrings": jsonStrings,
		"envKeys":     envKeys,
		"mask":        mask,
		"short":       short,
		"formatTime":  formatTime,
		"runnerAuth":  service.RunnerAuthConfigured,
	}).Parse(source))
	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return template.HTML(template.HTMLEscapeString(err.Error()))
	}
	return template.HTML(buf.String())
}

func formInt(c *gin.Context, key string, fallback int) int {
	value := strings.TrimSpace(c.PostForm(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseEnvLines(value string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(value, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		if key == "" {
			continue
		}
		out[key] = strings.TrimSpace(parts[1])
	}
	return out
}

func mask(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 8 {
		return "****"
	}
	return value[:4] + "..." + value[len(value)-4:]
}

func short(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 18 {
		return value
	}
	return value[:10] + "..." + value[len(value)-6:]
}

func formatTime(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	text := strings.Trim(string(raw), `"`)
	if text == "null" || text == "" {
		return "-"
	}
	return strings.ReplaceAll(text, "T", " ")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

const layoutTemplate = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{.Title}} · Imagen</title>
  <style>
    :root { color-scheme: light; --ink:#17181d; --muted:#667085; --line:#e7e2dc; --bg:#fbfaf7; --card:#fff; --accent:#e65f3c; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color:inherit; text-decoration:none; }
    header { height:64px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.85); display:flex; align-items:center; justify-content:space-between; padding:0 24px; position:sticky; top:0; z-index:3; backdrop-filter: blur(10px); }
    .brand { font-weight:760; letter-spacing:.02em; }
    .shell { display:grid; grid-template-columns:220px minmax(0,1fr); min-height:calc(100vh - 64px); }
    nav { border-right:1px solid var(--line); padding:18px 12px; background:#fff8; }
    nav a { display:block; padding:10px 12px; border-radius:8px; color:#475467; margin-bottom:4px; }
    nav a.active { color:#111827; background:white; box-shadow:0 1px 3px #0001; font-weight:650; }
    main { padding:24px; max-width:1440px; width:100%; }
    h1 { margin:0 0 18px; font-size:28px; line-height:1.2; }
    h2 { margin:0 0 12px; font-size:18px; }
    .grid { display:grid; gap:14px; }
    .metrics { grid-template-columns:repeat(5,minmax(0,1fr)); }
    .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px; box-shadow:0 1px 2px #00000008; }
    .metric .label { color:var(--muted); font-size:12px; }
    .metric .value { font-size:26px; font-weight:760; margin-top:6px; }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { font-size:12px; color:var(--muted); background:#f7f4ef; font-weight:650; }
    tr:last-child td { border-bottom:0; }
    input, select, textarea { width:100%; border:1px solid #d8d0c7; border-radius:7px; padding:8px 10px; font:inherit; background:white; }
    textarea { min-height:84px; resize:vertical; }
    button, .button { border:0; background:#17181d; color:white; border-radius:999px; padding:8px 14px; font:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
    button.secondary, .button.secondary { background:white; color:#17181d; border:1px solid var(--line); }
    .forms { grid-template-columns:repeat(4,minmax(0,1fr)); align-items:end; }
    .muted { color:var(--muted); }
    .pill { display:inline-flex; border:1px solid var(--line); border-radius:999px; padding:3px 8px; font-size:12px; background:#fff; }
    .status-succeeded, .status-active { color:#067647; }
    .status-failed, .status-disabled { color:#b42318; }
    .status-running, .status-queued { color:#b54708; }
    .notice { background:#fff6ed; border:1px solid #fed7aa; color:#9a3412; border-radius:8px; padding:10px 12px; margin:0 0 14px; }
    .top-user { display:flex; align-items:center; gap:10px; color:#475467; }
    .top-user img { width:28px; height:28px; border-radius:50%; }
    @media (max-width: 900px) { .shell { grid-template-columns:1fr; } nav { border-right:0; border-bottom:1px solid var(--line); } .metrics,.forms { grid-template-columns:1fr; } main { padding:16px; overflow:auto; } }
  </style>
</head>
<body>
  <header>
    <div class="brand">Imagen 管理后台</div>
    <div class="top-user">
      {{if .Session.Picture}}<img src="{{.Session.Picture}}" alt="" referrerpolicy="no-referrer" />{{end}}
      <span>{{.Session.Email}}</span>
      <form method="post" action="/admin/logout"><button class="secondary" type="submit">退出</button></form>
    </div>
  </header>
  <div class="shell">
    <nav>
      <a class="{{active .Active "dashboard"}}" href="/admin">总览</a>
      <a class="{{active .Active "api-keys"}}" href="/admin/api-keys">API 密钥</a>
      <a class="{{active .Active "tasks"}}" href="/admin/tasks">生成任务</a>
      <a class="{{active .Active "provider-accounts"}}" href="/admin/provider-accounts">引擎账号</a>
      <a class="{{active .Active "settings"}}" href="/admin/settings">系统设置</a>
    </nav>
    <main>{{.Content}}</main>
  </div>
</body>
</html>`

const loginTemplate = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>登录 · Imagen</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf7;font:14px/1.5 ui-sans-serif,system-ui}.card{width:min(420px,calc(100vw - 32px));background:white;border:1px solid #e7e2dc;border-radius:10px;padding:28px;box-shadow:0 16px 50px #0001}h1{margin:0 0 8px;font-size:26px}.muted{color:#667085}.button{display:inline-flex;margin-top:18px;background:#17181d;color:white;border-radius:999px;padding:10px 16px;text-decoration:none}.notice{background:#fff6ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:10px 12px;margin:14px 0}</style></head>
<body><section class="card"><h1>Imagen</h1><div class="muted">使用 Google 账号登录后台。</div>{{if .Error}}<div class="notice">{{.Error}}</div>{{end}}{{if .GoogleConfigured}}<a class="button" href="/admin/auth/google">使用 Google 登录</a>{{else}}<div class="notice">Google OAuth 尚未配置，请设置 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET。</div>{{end}}</section></body></html>`

const dashboardTemplate = `<h1>总览</h1>
<div class="grid metrics">
  <section class="card metric"><div class="label">总任务数</div><div class="value">{{.TotalTasks}}</div></section>
  <section class="card metric"><div class="label">排队中</div><div class="value">{{index .TaskCounts "queued"}}</div></section>
  <section class="card metric"><div class="label">生成中</div><div class="value">{{index .TaskCounts "running"}}</div></section>
  <section class="card metric"><div class="label">已完成</div><div class="value">{{index .TaskCounts "succeeded"}}</div></section>
  <section class="card metric"><div class="label">失败</div><div class="value">{{index .TaskCounts "failed"}}</div></section>
</div>
<div class="grid metrics" style="margin-top:14px">
  <section class="card metric"><div class="label">产出图片</div><div class="value">{{.TotalOutputImages}}</div></section>
  <section class="card metric"><div class="label">API 密钥</div><div class="value">{{.APIKeys}}</div></section>
  <section class="card metric"><div class="label">引擎账号</div><div class="value">{{.ProviderAccounts}}</div></section>
  <section class="card metric"><div class="label">存储类型</div><div class="value">{{.StorageProvider}}</div></section>
  <section class="card metric"><div class="label">存储状态</div><div class="value">{{if .StorageReady}}已就绪{{else}}未配置{{end}}</div></section>
</div>
<section class="card" style="margin-top:14px"><h2>输出地址</h2><div class="muted">{{.StoragePublicURL}}</div></section>`

const apiKeysTemplate = `<h1>API 密钥</h1>{{if .Message}}<div class="notice">{{.Message}}</div>{{end}}
<section class="card"><h2>创建 API 密钥</h2><form class="grid forms" method="post" action="/admin/api-keys">
<label>名称<input name="name" placeholder="客户 A"></label><label>总图片额度<input name="image_limit_total" type="number" value="1000"></label><label>每日额度<input name="image_limit_daily" type="number" value="100"></label><label>并发数<input name="max_concurrency" type="number" value="20"></label><button type="submit">创建</button></form></section>
<table style="margin-top:16px"><thead><tr><th>ID</th><th>名称</th><th>状态</th><th>总用量</th><th>每日用量</th><th>并发</th><th>更新</th></tr></thead><tbody>{{range .Keys}}<tr>
<form method="post" action="/admin/api-keys/{{.ID}}"><td>{{short .ID}}<br><span class="muted">{{.KeyPrefix}}</span></td><td><input name="name" value="{{.Name}}"></td><td><select name="status"><option value="active" {{if eq .Status "active"}}selected{{end}}>启用</option><option value="disabled" {{if eq .Status "disabled"}}selected{{end}}>停用</option></select></td><td><input name="image_limit_total" type="number" value="{{.ImageLimitTotal}}"><span class="muted">已用 {{.ImageUsedTotal}}</span></td><td><input name="image_limit_daily" type="number" value="{{.ImageLimitDaily}}"><span class="muted">已用 {{.ImageUsedDaily}}</span></td><td><input name="max_concurrency" type="number" value="{{.MaxConcurrency}}"></td><td><button type="submit">保存</button></td></form>
</tr>{{end}}</tbody></table>`

const tasksTemplate = `<h1>生成任务</h1><section class="card"><form method="get" action="/admin/tasks" style="display:flex;gap:10px;align-items:end;max-width:520px"><label>状态<select name="status"><option value="">全部</option><option value="queued" {{if eq .Status "queued"}}selected{{end}}>排队中</option><option value="running" {{if eq .Status "running"}}selected{{end}}>生成中</option><option value="succeeded" {{if eq .Status "succeeded"}}selected{{end}}>已完成</option><option value="failed" {{if eq .Status "failed"}}selected{{end}}>失败</option></select></label><button type="submit">筛选</button><span class="muted">共 {{.Total}} 个任务</span></form></section>
<table style="margin-top:16px"><thead><tr><th>ID</th><th>状态</th><th>API 密钥</th><th>提示词</th><th>图片</th><th>输出地址</th><th>错误</th><th>创建时间</th></tr></thead><tbody>{{range .Tasks}}<tr><td>{{short .ID}}</td><td class="status-{{.Status}}">{{.Status}}</td><td>{{short .APIKeyID}}</td><td style="max-width:360px">{{.Prompt}}</td><td>{{.OutputImageCount}} / {{.ImageCount}}</td><td>{{range jsonStrings .OutputURLsJSON}}<a href="{{.}}" target="_blank">{{short .}}</a><br>{{end}}</td><td class="muted" style="max-width:260px">{{.Error}}</td><td>{{formatTime .CreatedAt}}</td></tr>{{end}}</tbody></table>`

const providerAccountsTemplate = `<h1>引擎账号</h1>{{if .Message}}<div class="notice">{{.Message}}</div>{{end}}
	<section class="card"><h2>创建引擎账号</h2><form class="grid forms" method="post" action="/admin/provider-accounts">
		<label>名称<input name="name" placeholder="引擎账号 1"></label><label>状态<select name="status"><option value="active">启用</option><option value="disabled">停用</option></select></label><label>并发数<input name="max_concurrency" type="number" value="1"></label><label>每日图片<input name="daily_image_limit" type="number" value="0"></label><label>权重<input name="weight" type="number" value="100"></label><label>运行目录<input name="engine_home" placeholder="留空则自动生成"></label><label style="grid-column:span 2">认证 auth.json<textarea name="runner_auth_json" placeholder='{"auth_mode":"chatgpt","tokens":{...}}'></textarea></label><label style="grid-column:span 2">环境变量 / Token<textarea name="env_text" placeholder="OPENAI_API_KEY=..."></textarea></label><button type="submit">创建</button></form></section>
		<table style="margin-top:16px"><thead><tr><th>ID</th><th>名称</th><th>状态</th><th>额度</th><th>认证</th><th>运行目录</th><th>环境变量</th><th>错误</th><th>更新</th></tr></thead><tbody>{{range .Accounts}}<tr>
		<form method="post" action="/admin/provider-accounts/{{.ID}}"><td>{{short .ID}}</td><td><input name="name" value="{{.Name}}"></td><td><select name="status"><option value="active" {{if eq .Status "active"}}selected{{end}}>启用</option><option value="disabled" {{if eq .Status "disabled"}}selected{{end}}>停用</option></select></td><td><div>并发 <input name="max_concurrency" type="number" value="{{.MaxConcurrency}}"></div><div>每日 <input name="daily_image_limit" type="number" value="{{.DailyImageLimit}}"></div><div>权重 <input name="weight" type="number" value="{{.Weight}}"></div><span class="muted">运行中 {{.RunningCount}}，已用 {{.DailyImageUsed}}</span></td><td>{{if runnerAuth .EngineHome}}<span class="pill status-active">已安装</span>{{else}}<span class="pill status-disabled">缺失</span>{{end}}<textarea name="runner_auth_json" placeholder="粘贴新的 auth.json 后保存"></textarea></td><td><input name="engine_home" value="{{.EngineHome}}"></td><td>{{range envKeys .EnvJSON}}<span class="pill">{{.}}</span> {{end}}<textarea name="env_text" placeholder="填入 KEY=VALUE，勾选覆盖后保存"></textarea><label style="display:flex;gap:6px;align-items:center;margin-top:6px"><input style="width:auto" type="checkbox" name="replace_env" value="1"> 覆盖环境变量</label></td><td class="muted" style="max-width:220px">{{.LastError}}</td><td><button type="submit">保存</button></td></form>
	</tr>{{end}}</tbody></table>`

const settingsTemplate = `<h1>系统设置</h1>
<section class="card"><h2>存储</h2><table><tr><th>存储类型</th><td>{{.StorageProvider}}</td></tr><tr><th>公网 API 地址</th><td>{{.PublicBaseURL}}</td></tr><tr><th>本地存储目录</th><td>{{.StorageDir}}</td></tr><tr><th>R2 账号</th><td>{{.R2AccountID}}</td></tr><tr><th>R2 Access Key</th><td>{{.R2AccessKeyID}}</td></tr><tr><th>R2 Bucket</th><td>{{.R2Bucket}}</td></tr><tr><th>R2 公网地址</th><td>{{.R2PublicBaseURL}}</td></tr><tr><th>R2 路径前缀</th><td>{{.R2KeyPrefix}}</td></tr></table></section>
<section class="card" style="margin-top:16px"><h2>Google OAuth</h2><table><tr><th>Client ID</th><td>{{.GoogleClientID}}</td></tr><tr><th>回调地址</th><td>{{.GoogleRedirect}}</td></tr><tr><th>允许邮箱</th><td>{{range .AllowedEmails}}<span class="pill">{{.}}</span> {{end}}</td></tr><tr><th>允许域名</th><td>{{range .AllowedDomains}}<span class="pill">{{.}}</span> {{end}}</td></tr></table></section>
<div class="notice" style="margin-top:16px">密钥值通过环境变量或引擎账号的 Env 表单配置；后台只展示掩码或 key 名，不回显明文。</div>`
