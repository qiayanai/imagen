package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"imagen/backend/internal/config"
	"imagen/backend/internal/domain"
	"imagen/backend/internal/repository"
	"imagen/backend/internal/runner"
	"imagen/backend/internal/secret"
	"imagen/backend/internal/storage"
)

const defaultProvider = "default"

var ErrNoProviderAccount = repository.ErrNoProviderAccount

func IsNotFound(err error) bool {
	return repository.IsNotFound(err)
}

type App struct {
	Config config.Config
	Repo   *repository.Store
	Runner *runner.Runner
	Secret *secret.EnvBox
	Store  storage.Store
}

type CreateAPIKeyInput struct {
	Name            string `json:"name"`
	ImageLimitTotal int    `json:"image_limit_total"`
	ImageLimitDaily int    `json:"image_limit_daily"`
	MaxConcurrency  int    `json:"max_concurrency"`
}

type UpdateAPIKeyInput struct {
	Name            *string `json:"name"`
	Status          *string `json:"status"`
	ImageLimitTotal *int    `json:"image_limit_total"`
	ImageLimitDaily *int    `json:"image_limit_daily"`
	MaxConcurrency  *int    `json:"max_concurrency"`
}

type CreateProviderAccountInput struct {
	Name            string            `json:"name"`
	Provider        string            `json:"provider"`
	Status          string            `json:"status"`
	Weight          int               `json:"weight"`
	MaxConcurrency  int               `json:"max_concurrency"`
	DailyImageLimit int               `json:"daily_image_limit"`
	EngineHome      string            `json:"engine_home"`
	Env             map[string]string `json:"env"`
	RunnerAuthJSON  string            `json:"runner_auth_json"`
}

type UpdateProviderAccountInput struct {
	Name            *string           `json:"name"`
	Status          *string           `json:"status"`
	Weight          *int              `json:"weight"`
	MaxConcurrency  *int              `json:"max_concurrency"`
	DailyImageLimit *int              `json:"daily_image_limit"`
	EngineHome      *string           `json:"engine_home"`
	Env             map[string]string `json:"env"`
	ReplaceEnv      bool              `json:"replace_env"`
	RunnerAuthJSON  string            `json:"runner_auth_json"`
}

type CreateTaskInput struct {
	Prompt       string                 `json:"prompt"`
	ImageCount   int                    `json:"image_count"`
	Model        string                 `json:"model"`
	Size         string                 `json:"size"`
	Quality      string                 `json:"quality"`
	Background   string                 `json:"background"`
	OutputFormat string                 `json:"output_format"`
	Compression  int                    `json:"output_compression"`
	Moderation   string                 `json:"moderation"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type CreateBatchInput struct {
	Tasks        []CreateTaskInput `json:"tasks"`
	Model        string            `json:"model"`
	Size         string            `json:"size"`
	Quality      string            `json:"quality"`
	Background   string            `json:"background"`
	OutputFormat string            `json:"output_format"`
	Compression  int               `json:"output_compression"`
	Moderation   string            `json:"moderation"`
}

type QuotaSnapshot struct {
	ImageLimitTotal int `json:"image_limit_total"`
	ImageUsedTotal  int `json:"image_used_total"`
	ImageRemaining  int `json:"image_remaining"`
	ImageLimitDaily int `json:"image_limit_daily"`
	ImageUsedDaily  int `json:"image_used_daily"`
	DailyRemaining  int `json:"daily_remaining"`
	MaxConcurrency  int `json:"max_concurrency"`
}

type AdminOverview struct {
	TaskCounts        map[string]int64
	TotalTasks        int64
	TotalOutputImages int64
	APIKeys           int64
	ProviderAccounts  int64
	StorageProvider   string
	StorageReady      bool
	StoragePublicURL  string
}

func New(repo *repository.Store, cfg config.Config) (*App, error) {
	store, err := storage.New(cfg)
	if err != nil {
		return nil, err
	}
	return &App{
		Config: cfg,
		Repo:   repo,
		Runner: runner.NewRunner(cfg.RunnerPath, cfg.WorkDir, cfg.RunnerModel),
		Secret: secret.NewEnvBox(cfg.SecretKey),
		Store:  store,
	}, nil
}

func (a *App) EnsureDefaultProviderAccount(ctx context.Context) error {
	count, err := a.Repo.ProviderAccountCount(ctx)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err = a.CreateProviderAccount(ctx, CreateProviderAccountInput{
		Name:           "default-engine",
		Provider:       defaultProvider,
		Status:         domain.AccountActive,
		Weight:         100,
		MaxConcurrency: a.Config.DefaultAccountLimit,
	})
	return err
}

func (a *App) CreateAPIKey(ctx context.Context, in CreateAPIKeyInput) (domain.APIKey, string, error) {
	plain, prefix, hash, err := generateAPIKey()
	if err != nil {
		return domain.APIKey{}, "", err
	}
	total := in.ImageLimitTotal
	if total == 0 {
		total = a.Config.DefaultKeyImageCap
	}
	if total < -1 {
		total = -1
	}
	daily := in.ImageLimitDaily
	if daily < 0 {
		daily = 0
	}
	maxConcurrency := in.MaxConcurrency
	if maxConcurrency < 0 {
		maxConcurrency = 0
	}
	key := domain.APIKey{
		ID:              "key_" + uuid.NewString(),
		Name:            strings.TrimSpace(in.Name),
		KeyPrefix:       prefix,
		KeyHash:         hash,
		Status:          domain.APIKeyActive,
		ImageLimitTotal: total,
		ImageLimitDaily: daily,
		MaxConcurrency:  maxConcurrency,
		CurrentDay:      utcDay(time.Now()),
	}
	return key, plain, a.Repo.CreateAPIKey(ctx, key)
}

func (a *App) ListAPIKeys(ctx context.Context) ([]domain.APIKey, error) {
	return a.Repo.ListAPIKeys(ctx)
}

func (a *App) UpdateAPIKey(ctx context.Context, id string, in UpdateAPIKeyInput) (domain.APIKey, error) {
	updates := map[string]any{}
	if in.Name != nil {
		updates["name"] = strings.TrimSpace(*in.Name)
	}
	if in.Status != nil {
		status := strings.TrimSpace(*in.Status)
		if status != domain.APIKeyActive && status != domain.APIKeyDisabled {
			return domain.APIKey{}, errors.New("invalid api key status")
		}
		updates["status"] = status
	}
	if in.ImageLimitTotal != nil {
		updates["image_limit_total"] = *in.ImageLimitTotal
	}
	if in.ImageLimitDaily != nil {
		updates["image_limit_daily"] = *in.ImageLimitDaily
	}
	if in.MaxConcurrency != nil {
		updates["max_concurrency"] = *in.MaxConcurrency
	}
	return a.Repo.UpdateAPIKey(ctx, id, updates)
}

func (a *App) AuthenticateAPIKey(ctx context.Context, raw string) (domain.APIKey, error) {
	hash := hashAPIKey(raw)
	if hash == "" {
		return domain.APIKey{}, errors.New("api key is required")
	}
	key, err := a.Repo.GetAPIKeyByHash(ctx, hash)
	if err != nil {
		return domain.APIKey{}, errors.New("invalid api key")
	}
	if key.Status != domain.APIKeyActive {
		return domain.APIKey{}, errors.New("api key is disabled")
	}
	now := time.Now().UTC()
	if key.CurrentDay != utcDay(now) {
		key.CurrentDay = utcDay(now)
		key.ImageUsedDaily = 0
	}
	_ = a.Repo.TouchAPIKey(ctx, key, now)
	return key, nil
}

func (a *App) Quota(ctx context.Context, keyID string) (QuotaSnapshot, error) {
	key, err := a.Repo.GetAPIKey(ctx, keyID)
	if err != nil {
		return QuotaSnapshot{}, err
	}
	if key.CurrentDay != utcDay(time.Now()) {
		key.ImageUsedDaily = 0
	}
	return quotaSnapshot(key), nil
}

func (a *App) CreateTask(ctx context.Context, key domain.APIKey, in CreateTaskInput) (domain.ImageTask, error) {
	in, err := a.normalizeTaskInput(in)
	if err != nil {
		return domain.ImageTask{}, err
	}
	now := time.Now().UTC()
	task := domain.ImageTask{
		ID:              "task_" + uuid.NewString(),
		APIKeyID:        key.ID,
		Status:          domain.TaskQueued,
		Prompt:          strings.TrimSpace(in.Prompt),
		ImageCount:      in.ImageCount,
		Model:           strings.TrimSpace(in.Model),
		Size:            strings.TrimSpace(in.Size),
		Quality:         strings.TrimSpace(in.Quality),
		Background:      strings.TrimSpace(in.Background),
		OutputFormat:    strings.TrimSpace(in.OutputFormat),
		Compression:     in.Compression,
		Moderation:      strings.TrimSpace(in.Moderation),
		QueuedAt:        now,
		RequestJSON:     mustJSON(in),
		OutputURLsJSON:  []byte("[]"),
		OutputPathsJSON: []byte("[]"),
	}
	err = a.Repo.CreateTaskWithQuota(ctx, key.ID, task, task.ImageCount, 1)
	return task, err
}

func (a *App) CreateBatch(ctx context.Context, key domain.APIKey, in CreateBatchInput) (domain.ImageBatch, []domain.ImageTask, error) {
	if len(in.Tasks) == 0 {
		return domain.ImageBatch{}, nil, errors.New("tasks are required")
	}
	if len(in.Tasks) > 100 {
		return domain.ImageBatch{}, nil, errors.New("batch task limit is 100")
	}
	tasks := make([]domain.ImageTask, 0, len(in.Tasks))
	totalImages := 0
	now := time.Now().UTC()
	batch := domain.ImageBatch{
		ID:         "batch_" + uuid.NewString(),
		APIKeyID:   key.ID,
		Status:     domain.BatchQueued,
		TotalTasks: len(in.Tasks),
		CreatedAt:  now,
	}
	for _, item := range in.Tasks {
		item = applyBatchDefaults(item, in)
		normalized, err := a.normalizeTaskInput(item)
		if err != nil {
			return domain.ImageBatch{}, nil, err
		}
		totalImages += normalized.ImageCount
		task := domain.ImageTask{
			ID:              "task_" + uuid.NewString(),
			APIKeyID:        key.ID,
			BatchID:         batch.ID,
			Status:          domain.TaskQueued,
			Prompt:          strings.TrimSpace(normalized.Prompt),
			ImageCount:      normalized.ImageCount,
			Model:           strings.TrimSpace(normalized.Model),
			Size:            strings.TrimSpace(normalized.Size),
			Quality:         strings.TrimSpace(normalized.Quality),
			Background:      strings.TrimSpace(normalized.Background),
			OutputFormat:    strings.TrimSpace(normalized.OutputFormat),
			Compression:     normalized.Compression,
			Moderation:      strings.TrimSpace(normalized.Moderation),
			QueuedAt:        now,
			RequestJSON:     mustJSON(normalized),
			OutputURLsJSON:  []byte("[]"),
			OutputPathsJSON: []byte("[]"),
		}
		tasks = append(tasks, task)
	}
	batch.RequestedImages = totalImages
	err := a.Repo.CreateBatchWithQuota(ctx, key.ID, batch, tasks, totalImages)
	return batch, tasks, err
}

func (a *App) GetTask(ctx context.Context, keyID, taskID string) (domain.ImageTask, error) {
	return a.Repo.GetTask(ctx, keyID, taskID)
}

func (a *App) ListTasks(ctx context.Context, keyID, status string, limit, offset int) ([]domain.ImageTask, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return a.Repo.ListTasks(ctx, keyID, status, limit, offset)
}

func (a *App) GetBatch(ctx context.Context, keyID, batchID string) (domain.ImageBatch, []domain.ImageTask, error) {
	return a.Repo.GetBatch(ctx, keyID, batchID)
}

func (a *App) CreateProviderAccount(ctx context.Context, in CreateProviderAccountInput) (domain.ProviderAccount, error) {
	if strings.TrimSpace(in.Provider) == "" {
		in.Provider = defaultProvider
	}
	if strings.TrimSpace(in.Status) == "" {
		in.Status = domain.AccountActive
	}
	if in.Status != domain.AccountActive && in.Status != domain.AccountDisabled {
		return domain.ProviderAccount{}, errors.New("invalid provider account status")
	}
	if in.Weight <= 0 {
		in.Weight = 100
	}
	if in.MaxConcurrency <= 0 {
		in.MaxConcurrency = 1
	}
	accountID := "acct_" + uuid.NewString()
	engineHome := strings.TrimSpace(in.EngineHome)
	authJSON := strings.TrimSpace(in.RunnerAuthJSON)
	if strings.TrimSpace(authJSON) != "" && engineHome == "" {
		engineHome = filepath.Join(a.Config.EngineHomeDir, accountID)
	}
	if err := installRunnerAuth(engineHome, authJSON); err != nil {
		return domain.ProviderAccount{}, err
	}
	account := domain.ProviderAccount{
		ID:              accountID,
		Name:            strings.TrimSpace(in.Name),
		Provider:        normalizeProvider(in.Provider),
		Status:          strings.TrimSpace(in.Status),
		Weight:          in.Weight,
		MaxConcurrency:  in.MaxConcurrency,
		DailyImageLimit: in.DailyImageLimit,
		EngineHome:      engineHome,
		EnvJSON:         a.Secret.SealMap(in.Env),
		CurrentDay:      utcDay(time.Now()),
	}
	return account, a.Repo.CreateProviderAccount(ctx, account)
}

func (a *App) ListProviderAccounts(ctx context.Context) ([]domain.ProviderAccount, error) {
	return a.Repo.ListProviderAccounts(ctx)
}

func (a *App) UpdateProviderAccount(ctx context.Context, id string, in UpdateProviderAccountInput) (domain.ProviderAccount, error) {
	updates := map[string]any{}
	if in.Name != nil {
		updates["name"] = strings.TrimSpace(*in.Name)
	}
	if in.Status != nil {
		status := strings.TrimSpace(*in.Status)
		if status != domain.AccountActive && status != domain.AccountDisabled {
			return domain.ProviderAccount{}, errors.New("invalid provider account status")
		}
		updates["status"] = status
	}
	if in.Weight != nil {
		updates["weight"] = *in.Weight
	}
	if in.MaxConcurrency != nil {
		updates["max_concurrency"] = *in.MaxConcurrency
	}
	if in.DailyImageLimit != nil {
		updates["daily_image_limit"] = *in.DailyImageLimit
	}
	if in.EngineHome != nil {
		updates["engine_home"] = strings.TrimSpace(*in.EngineHome)
	}
	if in.ReplaceEnv {
		updates["env_json"] = a.Secret.SealMap(in.Env)
	}
	authJSON := strings.TrimSpace(in.RunnerAuthJSON)
	if strings.TrimSpace(authJSON) != "" {
		account, err := a.Repo.GetProviderAccount(ctx, id)
		if err != nil {
			return domain.ProviderAccount{}, err
		}
		engineHome := strings.TrimSpace(account.EngineHome)
		if in.EngineHome != nil {
			engineHome = strings.TrimSpace(*in.EngineHome)
		}
		if engineHome == "" {
			engineHome = filepath.Join(a.Config.EngineHomeDir, account.ID)
			updates["engine_home"] = engineHome
		}
		if err := installRunnerAuth(engineHome, authJSON); err != nil {
			return domain.ProviderAccount{}, err
		}
	}
	return a.Repo.UpdateProviderAccount(ctx, id, updates)
}

func (a *App) ClaimQueuedTask(ctx context.Context) (domain.ImageTask, bool, error) {
	return a.Repo.ClaimQueuedTask(ctx)
}

func (a *App) RunTask(ctx context.Context, task domain.ImageTask) error {
	account, err := a.Repo.AcquireProviderAccount(ctx, task.ImageCount)
	if err != nil {
		_ = a.Repo.RequeueTask(context.Background(), task.ID, err.Error())
		return err
	}
	releaseError := ""
	defer func() {
		_ = a.Repo.ReleaseProviderAccount(context.Background(), account.ID, releaseError)
	}()

	start := time.Now()
	outputDir := filepath.Join(a.Config.StorageDir, "tasks", task.ID)
	timeout := timeoutForCount(a.Config.TaskTimeout, task.ImageCount)
	if err := a.Repo.SetTaskProviderAccount(ctx, task.ID, account.ID); err != nil {
		return err
	}
	result, runErr := a.Runner.Run(ctx, runner.Request{
		Prompt:     task.Prompt,
		ImageCount: task.ImageCount,
		OutputDir:  outputDir,
		Timeout:    timeout,
		Options: runner.GenerationOptions{
			Model:        task.Model,
			Size:         task.Size,
			Quality:      task.Quality,
			Background:   task.Background,
			OutputFormat: task.OutputFormat,
			Compression:  task.Compression,
			Moderation:   task.Moderation,
		},
		Account: a.providerAccountToRunner(account),
	})
	if runErr != nil {
		releaseError = runErr.Error()
	}
	urls, paths, storeErr := a.storeGeneratedImages(context.Background(), task.ID, result.Images)
	if storeErr != nil && runErr == nil {
		runErr = storeErr
		releaseError = storeErr.Error()
	}
	status := domain.TaskSucceeded
	errText := ""
	if runErr != nil {
		status = domain.TaskFailed
		errText = runErr.Error()
	}
	if len(urls) == 0 && runErr == nil {
		status = domain.TaskFailed
		errText = "generation completed without image output"
	}
	return a.finishTask(context.Background(), task, status, urls, paths, result, time.Since(start), errText)
}

func (a *App) AdminListTasks(ctx context.Context, status string, limit, offset int) ([]domain.ImageTask, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	return a.Repo.AdminListTasks(ctx, status, limit, offset)
}

func (a *App) AdminOverview(ctx context.Context) (AdminOverview, error) {
	overview, err := a.Repo.AdminOverview(ctx)
	if err != nil {
		return AdminOverview{}, err
	}
	storageReady := a.Store != nil
	publicURL := a.Config.PublicBaseURL
	if strings.EqualFold(a.Config.StorageProvider, "r2") {
		publicURL = a.Config.R2PublicBaseURL
		storageReady = storageReady &&
			strings.TrimSpace(a.Config.R2AccountID) != "" &&
			strings.TrimSpace(a.Config.R2AccessKeyID) != "" &&
			strings.TrimSpace(a.Config.R2SecretAccessKey) != "" &&
			strings.TrimSpace(a.Config.R2Bucket) != "" &&
			strings.TrimSpace(a.Config.R2PublicBaseURL) != ""
	}
	return AdminOverview{
		TaskCounts:        overview.TaskCounts,
		TotalTasks:        overview.TotalTasks,
		TotalOutputImages: overview.TotalOutputImages,
		APIKeys:           overview.APIKeys,
		ProviderAccounts:  overview.ProviderAccounts,
		StorageProvider:   a.Config.StorageProvider,
		StorageReady:      storageReady,
		StoragePublicURL:  publicURL,
	}, nil
}

func (a *App) finishTask(ctx context.Context, task domain.ImageTask, status string, urls, paths []string, result runner.Result, duration time.Duration, errText string) error {
	finished := time.Now().UTC()
	updates := map[string]any{
		"status":               status,
		"output_image_count":   len(urls),
		"output_urls_json":     mustJSON(urls),
		"output_paths_json":    mustJSON(paths),
		"error":                errText,
		"finished_at":          &finished,
		"duration_millis":      duration.Milliseconds(),
		"provider_duration_ms": result.Duration.Milliseconds(),
		"transcript":           result.Transcript,
		"response_json":        result.RawJSON,
	}
	return a.Repo.FinishTask(ctx, task, updates)
}

func (a *App) normalizeTaskInput(in CreateTaskInput) (CreateTaskInput, error) {
	in.Prompt = strings.TrimSpace(in.Prompt)
	if in.Prompt == "" {
		return in, errors.New("prompt is required")
	}
	if in.ImageCount <= 0 {
		in.ImageCount = 1
	}
	maxImages := a.Config.MaxImagesPerTask
	if maxImages <= 0 {
		maxImages = 10
	}
	if in.ImageCount > maxImages {
		return in, fmt.Errorf("image_count exceeds max %d", maxImages)
	}
	if strings.TrimSpace(in.OutputFormat) == "" {
		in.OutputFormat = "png"
	}
	return in, nil
}

func applyBatchDefaults(item CreateTaskInput, batch CreateBatchInput) CreateTaskInput {
	if item.Model == "" {
		item.Model = batch.Model
	}
	if item.Size == "" {
		item.Size = batch.Size
	}
	if item.Quality == "" {
		item.Quality = batch.Quality
	}
	if item.Background == "" {
		item.Background = batch.Background
	}
	if item.OutputFormat == "" {
		item.OutputFormat = batch.OutputFormat
	}
	if item.Compression == 0 {
		item.Compression = batch.Compression
	}
	if item.Moderation == "" {
		item.Moderation = batch.Moderation
	}
	return item
}

func normalizeProvider(provider string) string {
	value := strings.ToLower(strings.TrimSpace(provider))
	switch value {
	case "", "default", "engine", "image":
		return defaultProvider
	default:
		return value
	}
}

func (a *App) providerAccountToRunner(account domain.ProviderAccount) runner.Account {
	return runner.Account{
		ID:         account.ID,
		EngineHome: account.EngineHome,
		Env:        a.Secret.OpenMap(account.EnvJSON),
	}
}

func (a *App) storeGeneratedImages(ctx context.Context, taskID string, images []string) ([]string, []string, error) {
	urls := make([]string, 0, len(images))
	paths := make([]string, 0, len(images))
	for index, image := range images {
		stored, err := a.Store.SaveGenerated(ctx, image, taskID, index+1)
		if err != nil {
			return urls, paths, err
		}
		urls = append(urls, stored.URL)
		paths = append(paths, stored.Path)
	}
	return urls, paths, nil
}

func quotaSnapshot(key domain.APIKey) QuotaSnapshot {
	imageRemaining := -1
	if key.ImageLimitTotal >= 0 {
		imageRemaining = key.ImageLimitTotal - key.ImageUsedTotal
		if imageRemaining < 0 {
			imageRemaining = 0
		}
	}
	dailyRemaining := -1
	if key.ImageLimitDaily > 0 {
		dailyRemaining = key.ImageLimitDaily - key.ImageUsedDaily
		if dailyRemaining < 0 {
			dailyRemaining = 0
		}
	}
	return QuotaSnapshot{
		ImageLimitTotal: key.ImageLimitTotal,
		ImageUsedTotal:  key.ImageUsedTotal,
		ImageRemaining:  imageRemaining,
		ImageLimitDaily: key.ImageLimitDaily,
		ImageUsedDaily:  key.ImageUsedDaily,
		DailyRemaining:  dailyRemaining,
		MaxConcurrency:  key.MaxConcurrency,
	}
}

func generateAPIKey() (plain, prefix, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", "", err
	}
	plain = "sk_img_" + base64.RawURLEncoding.EncodeToString(buf)
	prefix = plain
	if len(prefix) > 18 {
		prefix = prefix[:18]
	}
	hash = hashAPIKey(plain)
	return plain, prefix, hash, nil
}

func hashAPIKey(raw string) string {
	raw = strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))
	if raw == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func timeoutForCount(base time.Duration, imageCount int) time.Duration {
	if base <= 0 {
		base = 15 * time.Minute
	}
	if imageCount <= 1 {
		return base
	}
	if imageCount > 10 {
		imageCount = 10
	}
	timeout := base + time.Duration(imageCount-1)*8*time.Minute
	if timeout > 90*time.Minute {
		return 90 * time.Minute
	}
	return timeout
}

func utcDay(t time.Time) string {
	return t.UTC().Format("2006-01-02")
}

func mustJSON(value any) []byte {
	raw, _ := json.Marshal(value)
	return raw
}
