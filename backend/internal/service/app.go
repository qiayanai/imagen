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
	"os"
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

const (
	defaultProvider                = "default"
	settingLibraryPublicEnabledKey = "library_public_enabled"
)

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
	CustomerID      string `json:"customer_id"`
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

type CreateCustomerInput struct {
	Name                   string `json:"name"`
	Email                  string `json:"email"`
	Status                 string `json:"status"`
	DefaultImageLimitTotal int    `json:"default_image_limit_total"`
	DefaultImageLimitDaily int    `json:"default_image_limit_daily"`
	DefaultMaxConcurrency  int    `json:"default_max_concurrency"`
}

type UpdateCustomerInput struct {
	Name                   *string `json:"name"`
	Email                  *string `json:"email"`
	Status                 *string `json:"status"`
	DefaultImageLimitTotal *int    `json:"default_image_limit_total"`
	DefaultImageLimitDaily *int    `json:"default_image_limit_daily"`
	DefaultMaxConcurrency  *int    `json:"default_max_concurrency"`
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
	Customers         int64
	APIKeys           int64
	LibraryAssets     int64
	ProviderAccounts  int64
	StorageProvider   string
	StorageReady      bool
	StoragePublicURL  string
}

type RuntimeSettings struct {
	LibraryPublicEnabled bool `json:"library_public_enabled"`
}

type UpdateRuntimeSettingsInput struct {
	LibraryPublicEnabled *bool `json:"library_public_enabled"`
}

type LibraryAssetFilter struct {
	Status   string
	Category string
	Query    string
	Featured *bool
	Limit    int
	Offset   int
}

func New(repo *repository.Store, cfg config.Config) (*App, error) {
	if err := ensureRuntimeDirs(cfg); err != nil {
		return nil, err
	}
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

func ensureRuntimeDirs(cfg config.Config) error {
	dirs := []struct {
		label string
		path  string
		perm  os.FileMode
	}{
		{label: "storage dir", path: cfg.StorageDir, perm: 0o755},
		{label: "engine home dir", path: cfg.EngineHomeDir, perm: 0o700},
		{label: "work dir", path: cfg.WorkDir, perm: 0o755},
	}
	for _, dir := range dirs {
		path := strings.TrimSpace(dir.path)
		if path == "" {
			continue
		}
		if err := os.MkdirAll(path, dir.perm); err != nil {
			return fmt.Errorf("create %s %q: %w", dir.label, path, err)
		}
	}
	return nil
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

func (a *App) CreateCustomer(ctx context.Context, in CreateCustomerInput) (domain.Customer, string, error) {
	plain, prefix, hash, err := generatePortalKey()
	if err != nil {
		return domain.Customer{}, "", err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return domain.Customer{}, "", errors.New("customer name is required")
	}
	status := strings.TrimSpace(in.Status)
	if status == "" {
		status = domain.CustomerActive
	}
	if status != domain.CustomerActive && status != domain.CustomerDisabled {
		return domain.Customer{}, "", errors.New("invalid customer status")
	}
	total := in.DefaultImageLimitTotal
	if total == 0 {
		total = a.Config.DefaultKeyImageCap
	}
	if total < -1 {
		total = -1
	}
	daily := in.DefaultImageLimitDaily
	if daily < 0 {
		daily = 0
	}
	concurrency := in.DefaultMaxConcurrency
	if concurrency < 0 {
		concurrency = 0
	}
	customer := domain.Customer{
		ID:                     "cus_" + uuid.NewString(),
		Name:                   name,
		Email:                  strings.TrimSpace(in.Email),
		Status:                 status,
		PortalKeyPrefix:        prefix,
		PortalKeyHash:          hash,
		DefaultImageLimitTotal: total,
		DefaultImageLimitDaily: daily,
		DefaultMaxConcurrency:  concurrency,
	}
	return customer, plain, a.Repo.CreateCustomer(ctx, customer)
}

func (a *App) ListCustomers(ctx context.Context) ([]domain.Customer, error) {
	return a.Repo.ListCustomers(ctx)
}

func (a *App) UpdateCustomer(ctx context.Context, id string, in UpdateCustomerInput) (domain.Customer, error) {
	updates := map[string]any{}
	if in.Name != nil {
		name := strings.TrimSpace(*in.Name)
		if name == "" {
			return domain.Customer{}, errors.New("customer name is required")
		}
		updates["name"] = name
	}
	if in.Email != nil {
		updates["email"] = strings.TrimSpace(*in.Email)
	}
	if in.Status != nil {
		status := strings.TrimSpace(*in.Status)
		if status != domain.CustomerActive && status != domain.CustomerDisabled {
			return domain.Customer{}, errors.New("invalid customer status")
		}
		updates["status"] = status
	}
	if in.DefaultImageLimitTotal != nil {
		total := *in.DefaultImageLimitTotal
		if total < -1 {
			total = -1
		}
		updates["default_image_limit_total"] = total
	}
	if in.DefaultImageLimitDaily != nil {
		daily := *in.DefaultImageLimitDaily
		if daily < 0 {
			daily = 0
		}
		updates["default_image_limit_daily"] = daily
	}
	if in.DefaultMaxConcurrency != nil {
		concurrency := *in.DefaultMaxConcurrency
		if concurrency < 0 {
			concurrency = 0
		}
		updates["default_max_concurrency"] = concurrency
	}
	return a.Repo.UpdateCustomer(ctx, id, updates)
}

func (a *App) DeleteCustomer(ctx context.Context, id string) error {
	return a.Repo.DeleteCustomer(ctx, id)
}

func (a *App) AuthenticateCustomer(ctx context.Context, raw string) (domain.Customer, error) {
	hash := hashToken(raw)
	if hash == "" {
		return domain.Customer{}, errors.New("dashboard token is required")
	}
	customer, err := a.Repo.GetCustomerByPortalKeyHash(ctx, hash)
	if err != nil {
		return domain.Customer{}, errors.New("invalid dashboard token")
	}
	if customer.Status != domain.CustomerActive {
		return domain.Customer{}, errors.New("customer is disabled")
	}
	return customer, nil
}

func (a *App) GetOrCreateCustomerForGoogle(ctx context.Context, email, name string) (domain.Customer, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return domain.Customer{}, errors.New("customer email is required")
	}
	customer, err := a.Repo.GetCustomerByEmail(ctx, email)
	if err == nil {
		if customer.Status != domain.CustomerActive {
			return domain.Customer{}, errors.New("customer is disabled")
		}
		return customer, nil
	}
	if !IsNotFound(err) {
		return domain.Customer{}, err
	}
	displayName := strings.TrimSpace(name)
	if displayName == "" {
		displayName = strings.TrimSpace(strings.Split(email, "@")[0])
	}
	if displayName == "" {
		displayName = email
	}
	customer, _, err = a.CreateCustomer(ctx, CreateCustomerInput{
		Name:                   displayName,
		Email:                  email,
		Status:                 domain.CustomerActive,
		DefaultImageLimitTotal: a.Config.DefaultKeyImageCap,
		DefaultImageLimitDaily: 0,
		DefaultMaxConcurrency:  0,
	})
	return customer, err
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
		CustomerID:      strings.TrimSpace(in.CustomerID),
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

func (a *App) CreateCustomerAPIKey(ctx context.Context, customer domain.Customer, name string) (domain.APIKey, string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return domain.APIKey{}, "", errors.New("api key name is required")
	}
	return a.CreateAPIKey(ctx, CreateAPIKeyInput{
		Name:            name,
		CustomerID:      customer.ID,
		ImageLimitTotal: customer.DefaultImageLimitTotal,
		ImageLimitDaily: customer.DefaultImageLimitDaily,
		MaxConcurrency:  customer.DefaultMaxConcurrency,
	})
}

func (a *App) ListAPIKeys(ctx context.Context) ([]domain.APIKey, error) {
	return a.Repo.ListAPIKeys(ctx)
}

func (a *App) ListCustomerAPIKeys(ctx context.Context, customerID string) ([]domain.APIKey, error) {
	return a.Repo.ListAPIKeysByCustomer(ctx, customerID)
}

func (a *App) GetCustomerAPIKey(ctx context.Context, customerID, keyID string) (domain.APIKey, error) {
	return a.Repo.GetAPIKeyForCustomer(ctx, customerID, keyID)
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

func (a *App) UpdateCustomerAPIKey(ctx context.Context, customerID, keyID string, in UpdateAPIKeyInput) (domain.APIKey, error) {
	if _, err := a.Repo.GetAPIKeyForCustomer(ctx, customerID, keyID); err != nil {
		return domain.APIKey{}, err
	}
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
	return a.Repo.UpdateAPIKey(ctx, keyID, updates)
}

func (a *App) DeleteAPIKey(ctx context.Context, id string) error {
	return a.Repo.DeleteAPIKey(ctx, id)
}

func (a *App) DeleteCustomerAPIKey(ctx context.Context, customerID, keyID string) error {
	return a.Repo.DeleteAPIKeyForCustomer(ctx, customerID, keyID)
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

func (a *App) DeleteProviderAccount(ctx context.Context, id string) error {
	return a.Repo.DeleteProviderAccount(ctx, id)
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

func (a *App) UpsertLibraryAsset(ctx context.Context, asset domain.LibraryAsset) error {
	if strings.TrimSpace(asset.ID) == "" {
		asset.ID = "lib_" + uuid.NewString()
	}
	if strings.TrimSpace(asset.Status) == "" {
		asset.Status = domain.LibraryAssetPublished
	}
	return a.Repo.UpsertLibraryAsset(ctx, asset)
}

func (a *App) ListLibraryAssets(ctx context.Context, filter LibraryAssetFilter) ([]domain.LibraryAsset, int64, error) {
	if strings.TrimSpace(filter.Status) == "" {
		filter.Status = domain.LibraryAssetPublished
	}
	return a.Repo.ListLibraryAssets(ctx, repository.LibraryAssetFilter{
		Status:   filter.Status,
		Category: filter.Category,
		Query:    filter.Query,
		Featured: filter.Featured,
		Limit:    filter.Limit,
		Offset:   filter.Offset,
	})
}

func (a *App) UpdateLibraryAssetFeatured(ctx context.Context, id string, featured bool) (domain.LibraryAsset, error) {
	return a.Repo.UpdateLibraryAssetFeatured(ctx, id, featured)
}

func (a *App) LibraryAssetCategories(ctx context.Context) ([]repository.CategoryCount, error) {
	return a.Repo.LibraryAssetCategories(ctx)
}

func (a *App) RuntimeSettings(ctx context.Context) (RuntimeSettings, error) {
	value, ok, err := a.Repo.GetSystemSetting(ctx, settingLibraryPublicEnabledKey)
	if err != nil {
		return RuntimeSettings{}, err
	}
	return RuntimeSettings{
		LibraryPublicEnabled: boolSetting(value, true, ok),
	}, nil
}

func (a *App) UpdateRuntimeSettings(ctx context.Context, in UpdateRuntimeSettingsInput) (RuntimeSettings, error) {
	if in.LibraryPublicEnabled != nil {
		if err := a.Repo.SetSystemSetting(ctx, settingLibraryPublicEnabledKey, formatBoolSetting(*in.LibraryPublicEnabled)); err != nil {
			return RuntimeSettings{}, err
		}
	}
	return a.RuntimeSettings(ctx)
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
		Customers:         overview.Customers,
		APIKeys:           overview.APIKeys,
		LibraryAssets:     overview.LibraryAssets,
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
	return generateToken("sk_img_")
}

func generatePortalKey() (plain, prefix, hash string, err error) {
	return generateToken("cus_portal_")
}

func generateToken(prefixValue string) (plain, prefix, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return "", "", "", err
	}
	plain = prefixValue + base64.RawURLEncoding.EncodeToString(buf)
	prefix = plain
	if len(prefix) > 18 {
		prefix = prefix[:18]
	}
	hash = hashToken(plain)
	return plain, prefix, hash, nil
}

func hashAPIKey(raw string) string {
	return hashToken(raw)
}

func hashToken(raw string) string {
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

func boolSetting(value string, fallback bool, exists bool) bool {
	if !exists {
		return fallback
	}
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on", "enabled":
		return true
	case "0", "false", "no", "off", "disabled":
		return false
	default:
		return fallback
	}
}

func formatBoolSetting(value bool) string {
	if value {
		return "true"
	}
	return "false"
}

func utcDay(t time.Time) string {
	return t.UTC().Format("2006-01-02")
}

func mustJSON(value any) []byte {
	raw, _ := json.Marshal(value)
	return raw
}
