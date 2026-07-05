package httpapi

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"imagen/backend/internal/domain"
	"imagen/backend/internal/secret"
	"imagen/backend/internal/service"
	"imagen/backend/internal/storage"
)

type API struct {
	app *service.App
}

func New(app *service.App) *gin.Engine {
	api := &API{app: app}
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery(), cors(app.Config.CORSAllowedOrigins))
	r.GET("/healthz", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.GET("/files/*key", api.file)
	r.HEAD("/files/*key", api.file)
	r.GET("/", func(c *gin.Context) { c.Redirect(http.StatusFound, "/admin") })

	adminWeb := r.Group("/admin")
	adminWeb.GET("/login", api.adminLoginPage)
	adminWeb.GET("/auth/google", api.googleStart)
	adminWeb.GET("/auth/google/callback", api.googleCallback)
	adminWeb.POST("/logout", api.adminLogout)
	adminWeb.GET("/logout", api.adminLogout)
	protectedAdminWeb := adminWeb.Group("")
	protectedAdminWeb.Use(api.requireAdminSession())
	protectedAdminWeb.GET("", api.adminDashboard)
	protectedAdminWeb.GET("/api-keys", api.adminAPIKeysPage)
	protectedAdminWeb.POST("/api-keys", api.adminCreateAPIKeyForm)
	protectedAdminWeb.POST("/api-keys/:id", api.adminUpdateAPIKeyForm)
	protectedAdminWeb.GET("/tasks", api.adminTasksPage)
	protectedAdminWeb.GET("/provider-accounts", api.adminProviderAccountsPage)
	protectedAdminWeb.POST("/provider-accounts", api.adminCreateProviderAccountForm)
	protectedAdminWeb.POST("/provider-accounts/:id", api.adminUpdateProviderAccountForm)
	protectedAdminWeb.GET("/settings", api.adminSettingsPage)

	v1 := r.Group("/v1")
	v1.GET("/quota", api.requireAPIKey(), api.quota)
	v1.POST("/tasks", api.requireAPIKey(), api.createTask)
	v1.GET("/tasks", api.requireAPIKey(), api.listTasks)
	v1.GET("/tasks/:id", api.requireAPIKey(), api.getTask)
	v1.POST("/batches", api.requireAPIKey(), api.createBatch)
	v1.GET("/batches/:id", api.requireAPIKey(), api.getBatch)

	v1.GET("/admin/me", api.adminMe)
	v1.POST("/admin/logout", api.adminAPILogout)

	admin := v1.Group("/admin")
	admin.Use(api.requireAdmin())
	admin.GET("/overview", api.adminOverview)
	admin.GET("/settings", api.adminSettings)
	admin.POST("/api-keys", api.createAPIKey)
	admin.GET("/api-keys", api.listAPIKeys)
	admin.PATCH("/api-keys/:id", api.updateAPIKey)
	admin.POST("/provider-accounts", api.createProviderAccount)
	admin.GET("/provider-accounts", api.listProviderAccounts)
	admin.PATCH("/provider-accounts/:id", api.updateProviderAccount)
	admin.GET("/tasks", api.adminListTasks)

	return r
}

func (a *API) file(c *gin.Context) {
	key := strings.TrimPrefix(c.Param("key"), "/")
	path, err := storage.LocalFilePath(a.app.Config.StorageDir, key)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.File(path)
}

func (a *API) createTask(c *gin.Context) {
	key := currentAPIKey(c)
	var req service.CreateTaskInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	task, err := a.app.CreateTask(c.Request.Context(), key, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	quota, _ := a.app.Quota(c.Request.Context(), key.ID)
	c.JSON(http.StatusAccepted, gin.H{"task": taskDTO(task), "quota": quota})
}

func (a *API) createBatch(c *gin.Context) {
	key := currentAPIKey(c)
	var req service.CreateBatchInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	batch, tasks, err := a.app.CreateBatch(c.Request.Context(), key, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	quota, _ := a.app.Quota(c.Request.Context(), key.ID)
	out := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		out = append(out, taskDTO(task))
	}
	c.JSON(http.StatusAccepted, gin.H{"batch": batchDTO(batch), "tasks": out, "quota": quota})
}

func (a *API) getTask(c *gin.Context) {
	key := currentAPIKey(c)
	task, err := a.app.GetTask(c.Request.Context(), key.ID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		if service.IsNotFound(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "task not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"task": taskDTO(task)})
}

func (a *API) listTasks(c *gin.Context) {
	key := currentAPIKey(c)
	limit, offset := limitOffset(c)
	tasks, total, err := a.app.ListTasks(c.Request.Context(), key.ID, c.Query("status"), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		out = append(out, taskDTO(task))
	}
	c.JSON(http.StatusOK, gin.H{"items": out, "total": total, "limit": limit, "offset": offset})
}

func (a *API) getBatch(c *gin.Context) {
	key := currentAPIKey(c)
	batch, tasks, err := a.app.GetBatch(c.Request.Context(), key.ID, c.Param("id"))
	if err != nil {
		status := http.StatusInternalServerError
		if service.IsNotFound(err) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": "batch not found"})
		return
	}
	out := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		out = append(out, taskDTO(task))
	}
	c.JSON(http.StatusOK, gin.H{"batch": batchDTO(batch), "tasks": out})
}

func (a *API) quota(c *gin.Context) {
	key := currentAPIKey(c)
	quota, err := a.app.Quota(c.Request.Context(), key.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"quota": quota})
}

func (a *API) createAPIKey(c *gin.Context) {
	var req service.CreateAPIKeyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	key, plain, err := a.app.CreateAPIKey(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"api_key": plain, "key": apiKeyDTO(key)})
}

func (a *API) listAPIKeys(c *gin.Context) {
	keys, err := a.app.ListAPIKeys(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(keys))
	for _, key := range keys {
		out = append(out, apiKeyDTO(key))
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

func (a *API) updateAPIKey(c *gin.Context) {
	var req service.UpdateAPIKeyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	key, err := a.app.UpdateAPIKey(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"key": apiKeyDTO(key)})
}

func (a *API) createProviderAccount(c *gin.Context) {
	var req service.CreateProviderAccountInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	account, err := a.app.CreateProviderAccount(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"account": providerAccountDTO(account)})
}

func (a *API) listProviderAccounts(c *gin.Context) {
	accounts, err := a.app.ListProviderAccounts(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(accounts))
	for _, account := range accounts {
		out = append(out, providerAccountDTO(account))
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

func (a *API) updateProviderAccount(c *gin.Context) {
	var req service.UpdateProviderAccountInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	account, err := a.app.UpdateProviderAccount(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"account": providerAccountDTO(account)})
}

func (a *API) adminListTasks(c *gin.Context) {
	limit, offset := limitOffset(c)
	tasks, total, err := a.app.AdminListTasks(c.Request.Context(), c.Query("status"), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]gin.H, 0, len(tasks))
	for _, task := range tasks {
		out = append(out, taskDTO(task))
	}
	c.JSON(http.StatusOK, gin.H{"items": out, "total": total, "limit": limit, "offset": offset})
}

func (a *API) adminMe(c *gin.Context) {
	session, ok := a.readAdminSession(c)
	loginURL := strings.TrimRight(a.app.Config.PublicBaseURL, "/") + "/admin/auth/google"
	if ok {
		c.JSON(http.StatusOK, gin.H{
			"authenticated": true,
			"user":          adminSessionDTO(session),
			"login_url":     loginURL,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"authenticated":     false,
		"user":              nil,
		"login_url":         loginURL,
		"google_configured": a.googleConfigured(),
	})
}

func (a *API) adminOverview(c *gin.Context) {
	overview, err := a.app.AdminOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"task_counts":         overview.TaskCounts,
		"total_tasks":         overview.TotalTasks,
		"total_output_images": overview.TotalOutputImages,
		"api_keys":            overview.APIKeys,
		"provider_accounts":   overview.ProviderAccounts,
		"storage_provider":    overview.StorageProvider,
		"storage_ready":       overview.StorageReady,
		"storage_public_url":  overview.StoragePublicURL,
	})
}

func (a *API) adminSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"public_base_url":       a.app.Config.PublicBaseURL,
		"web_base_url":          a.app.Config.WebBaseURL,
		"cors_allowed_origins":  a.app.Config.CORSAllowedOrigins,
		"storage_provider":      a.app.Config.StorageProvider,
		"storage_dir":           a.app.Config.StorageDir,
		"r2_account_id":         maskString(a.app.Config.R2AccountID),
		"r2_access_key_id":      maskString(a.app.Config.R2AccessKeyID),
		"r2_bucket":             a.app.Config.R2Bucket,
		"r2_public_base_url":    a.app.Config.R2PublicBaseURL,
		"r2_key_prefix":         a.app.Config.R2KeyPrefix,
		"google_configured":     a.googleConfigured(),
		"google_client_id":      maskString(a.app.Config.GoogleClientID),
		"google_redirect_url":   firstNonEmpty(a.app.Config.GoogleRedirectURL, strings.TrimRight(a.app.Config.PublicBaseURL, "/")+"/admin/auth/google/callback"),
		"admin_allowed_emails":  a.app.Config.AdminAllowedEmails,
		"admin_allowed_domains": a.app.Config.AdminAllowedDomains,
	})
}

func (a *API) requireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if session, ok := a.readAdminSession(c); ok {
			c.Set("admin_session", session)
			c.Next()
			return
		}
		token := bearerToken(c)
		if token == "" {
			token = strings.TrimSpace(c.GetHeader("X-Admin-Token"))
		}
		if token == "" || token != a.app.Config.AdminToken {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "admin token required"})
			return
		}
		c.Next()
	}
}

func (a *API) requireAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := bearerToken(c)
		if raw == "" {
			raw = strings.TrimSpace(c.GetHeader("X-API-Key"))
		}
		key, err := a.app.AuthenticateAPIKey(c.Request.Context(), raw)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}
		c.Set("api_key", key)
		c.Next()
	}
}

func bearerToken(c *gin.Context) string {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return strings.TrimSpace(parts[1])
	}
	return header
}

func currentAPIKey(c *gin.Context) domain.APIKey {
	value, _ := c.Get("api_key")
	key, _ := value.(domain.APIKey)
	return key
}

func apiKeyDTO(key domain.APIKey) gin.H {
	return gin.H{
		"id":                key.ID,
		"name":              key.Name,
		"key_prefix":        key.KeyPrefix,
		"status":            key.Status,
		"image_limit_total": key.ImageLimitTotal,
		"image_used_total":  key.ImageUsedTotal,
		"image_limit_daily": key.ImageLimitDaily,
		"image_used_daily":  key.ImageUsedDaily,
		"current_day":       key.CurrentDay,
		"max_concurrency":   key.MaxConcurrency,
		"last_used_at":      key.LastUsedAt,
		"created_at":        key.CreatedAt,
		"updated_at":        key.UpdatedAt,
	}
}

func providerAccountDTO(account domain.ProviderAccount) gin.H {
	return gin.H{
		"id":                account.ID,
		"name":              providerAccountName(account.Name),
		"provider":          providerName(account.Provider),
		"status":            account.Status,
		"weight":            account.Weight,
		"max_concurrency":   account.MaxConcurrency,
		"running_count":     account.RunningCount,
		"daily_image_limit": account.DailyImageLimit,
		"daily_image_used":  account.DailyImageUsed,
		"current_day":       account.CurrentDay,
		"engine_home":       account.EngineHome,
		"auth_configured":   service.RunnerAuthConfigured(account.EngineHome),
		"env_keys":          envKeys(account.EnvJSON),
		"last_error":        account.LastError,
		"cooldown_until":    account.CooldownUntil,
		"created_at":        account.CreatedAt,
		"updated_at":        account.UpdatedAt,
	}
}

func providerAccountName(name string) string {
	if strings.EqualFold(strings.TrimSpace(name), "default-engine") {
		return "default-engine"
	}
	return name
}

func providerName(provider string) string {
	_ = provider
	return "default"
}

func taskDTO(task domain.ImageTask) gin.H {
	return gin.H{
		"id":                   task.ID,
		"batch_id":             task.BatchID,
		"api_key_id":           task.APIKeyID,
		"provider_account_id":  task.ProviderAccountID,
		"status":               task.Status,
		"prompt":               task.Prompt,
		"image_count":          task.ImageCount,
		"output_image_count":   task.OutputImageCount,
		"model":                task.Model,
		"size":                 task.Size,
		"quality":              task.Quality,
		"background":           task.Background,
		"output_format":        task.OutputFormat,
		"output_compression":   task.Compression,
		"moderation":           task.Moderation,
		"output_urls":          jsonStrings(task.OutputURLsJSON),
		"error":                task.Error,
		"attempt":              task.Attempt,
		"queued_at":            task.QueuedAt,
		"started_at":           task.StartedAt,
		"finished_at":          task.FinishedAt,
		"duration_millis":      task.DurationMillis,
		"provider_duration_ms": task.ProviderDurationMs,
		"created_at":           task.CreatedAt,
	}
}

func batchDTO(batch domain.ImageBatch) gin.H {
	return gin.H{
		"id":               batch.ID,
		"api_key_id":       batch.APIKeyID,
		"status":           batch.Status,
		"total_tasks":      batch.TotalTasks,
		"requested_images": batch.RequestedImages,
		"succeeded_tasks":  batch.SucceededTasks,
		"failed_tasks":     batch.FailedTasks,
		"output_images":    batch.OutputImages,
		"error":            batch.Error,
		"created_at":       batch.CreatedAt,
		"updated_at":       batch.UpdatedAt,
	}
}

func jsonStrings(raw []byte) []string {
	out := []string{}
	if len(raw) == 0 {
		return out
	}
	_ = json.Unmarshal(raw, &out)
	return out
}

func envKeys(raw []byte) []string {
	keys := secret.EnvKeys(raw)
	sort.Strings(keys)
	return keys
}

func limitOffset(c *gin.Context) (int, int) {
	limit := intParam(c, "limit", 50)
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	page := intParam(c, "page", 1)
	if page < 1 {
		page = 1
	}
	return limit, (page - 1) * limit
}

func intParam(c *gin.Context, key string, fallback int) int {
	value := strings.TrimSpace(c.Query(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func cors(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := strings.TrimRight(strings.TrimSpace(c.GetHeader("Origin")), "/")
		if origin != "" && originAllowed(origin, allowedOrigins) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Admin-Token")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func originAllowed(origin string, allowed []string) bool {
	if len(allowed) == 0 {
		return false
	}
	for _, item := range allowed {
		item = strings.TrimRight(strings.TrimSpace(item), "/")
		if item == "*" || strings.EqualFold(item, origin) {
			return true
		}
	}
	return false
}

func maskString(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if len(value) <= 8 {
		return "****"
	}
	return value[:4] + "..." + value[len(value)-4:]
}
