package repository

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"imagen/backend/internal/domain"
)

func TestSelectWeightedProviderAccountSkipsUnavailableAccounts(t *testing.T) {
	now := time.Date(2026, 7, 5, 12, 0, 0, 0, time.UTC)
	cooldown := now.Add(time.Minute)
	accounts := []domain.ProviderAccount{
		{ID: "cooldown", Weight: 100, MaxConcurrency: 1, CooldownUntil: &cooldown},
		{ID: "busy", Weight: 100, MaxConcurrency: 1, RunningCount: 1},
		{ID: "quota", Weight: 100, MaxConcurrency: 1, DailyImageLimit: 1, DailyImageUsed: 1, CurrentDay: "2026-07-05"},
		{ID: "zero-weight", Weight: 0, MaxConcurrency: 1},
		{ID: "ok", Weight: 10, MaxConcurrency: 1},
	}

	account, ok, err := selectWeightedProviderAccount(accounts, 1, now)
	if err != nil {
		t.Fatalf("selectWeightedProviderAccount() error = %v", err)
	}
	if !ok {
		t.Fatal("selectWeightedProviderAccount() ok = false, want true")
	}
	if account.ID != "ok" {
		t.Fatalf("selected account = %s, want ok", account.ID)
	}
}

func TestFinishTaskRefundsReservedQuotaOnFailure(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	now := time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC)
	task := seedReservedTask(t, store, now, 4)

	if err := store.FinishTask(ctx, task, map[string]any{
		"status":             domain.TaskFailed,
		"output_image_count": 0,
	}); err != nil {
		t.Fatalf("FinishTask() error = %v", err)
	}

	key, err := store.GetAPIKey(ctx, task.APIKeyID)
	if err != nil {
		t.Fatalf("GetAPIKey() error = %v", err)
	}
	if key.ImageUsedTotal != 0 || key.ImageUsedDaily != 0 {
		t.Fatalf("usage = total %d daily %d, want 0/0", key.ImageUsedTotal, key.ImageUsedDaily)
	}
}

func TestFinishTaskRefundIsIdempotent(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	now := time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC)
	task := seedReservedTask(t, store, now, 4)
	updates := map[string]any{
		"status":             domain.TaskFailed,
		"output_image_count": 0,
	}

	if err := store.FinishTask(ctx, task, updates); err != nil {
		t.Fatalf("FinishTask() first error = %v", err)
	}
	if err := store.FinishTask(ctx, task, updates); err != nil {
		t.Fatalf("FinishTask() second error = %v", err)
	}

	key, err := store.GetAPIKey(ctx, task.APIKeyID)
	if err != nil {
		t.Fatalf("GetAPIKey() error = %v", err)
	}
	if key.ImageUsedTotal != 0 || key.ImageUsedDaily != 0 {
		t.Fatalf("usage = total %d daily %d, want 0/0", key.ImageUsedTotal, key.ImageUsedDaily)
	}
}

func TestFinishTaskRefundsMissingOutputs(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	now := time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC)
	task := seedReservedTask(t, store, now, 4)

	if err := store.FinishTask(ctx, task, map[string]any{
		"status":             domain.TaskSucceeded,
		"output_image_count": 2,
	}); err != nil {
		t.Fatalf("FinishTask() error = %v", err)
	}

	key, err := store.GetAPIKey(ctx, task.APIKeyID)
	if err != nil {
		t.Fatalf("GetAPIKey() error = %v", err)
	}
	if key.ImageUsedTotal != 2 || key.ImageUsedDaily != 2 {
		t.Fatalf("usage = total %d daily %d, want 2/2", key.ImageUsedTotal, key.ImageUsedDaily)
	}
}

func TestReleaseProviderAccountRefundsMissingOutputs(t *testing.T) {
	store := newTestStore(t)
	ctx := context.Background()
	day := "2026-07-08"
	account := domain.ProviderAccount{
		ID:              "acct_test",
		Name:            "test",
		Provider:        "default",
		Status:          domain.AccountActive,
		Weight:          100,
		MaxConcurrency:  1,
		RunningCount:    1,
		DailyImageLimit: 10,
		DailyImageUsed:  4,
		CurrentDay:      day,
	}
	if err := store.CreateProviderAccount(ctx, account); err != nil {
		t.Fatalf("CreateProviderAccount() error = %v", err)
	}

	if err := store.ReleaseProviderAccount(ctx, account.ID, 4, 1, day, ""); err != nil {
		t.Fatalf("ReleaseProviderAccount() error = %v", err)
	}

	accounts, err := store.ListProviderAccounts(ctx)
	if err != nil {
		t.Fatalf("ListProviderAccounts() error = %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("provider accounts = %d, want 1", len(accounts))
	}
	got := accounts[0]
	if got.RunningCount != 0 || got.DailyImageUsed != 1 {
		t.Fatalf("provider running/daily = %d/%d, want 0/1", got.RunningCount, got.DailyImageUsed)
	}
}

func newTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := Open("", filepath.Join(t.TempDir(), "test.sqlite"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate() error = %v", err)
	}
	return NewStore(db)
}

func seedReservedTask(t *testing.T, store *Store, now time.Time, images int) domain.ImageTask {
	t.Helper()
	key := domain.APIKey{
		ID:              "key_test",
		Name:            "test",
		KeyPrefix:       "sk_test",
		KeyHash:         "hash_test",
		Status:          domain.APIKeyActive,
		ImageLimitTotal: 100,
		ImageUsedTotal:  images,
		ImageLimitDaily: 100,
		ImageUsedDaily:  images,
		CurrentDay:      utcDay(now),
		MaxConcurrency:  10,
	}
	if err := store.CreateAPIKey(context.Background(), key); err != nil {
		t.Fatalf("CreateAPIKey() error = %v", err)
	}
	task := domain.ImageTask{
		ID:              "task_test",
		APIKeyID:        key.ID,
		Status:          domain.TaskRunning,
		Prompt:          "test prompt",
		ImageCount:      images,
		QueuedAt:        now,
		OutputURLsJSON:  []byte("[]"),
		OutputPathsJSON: []byte("[]"),
	}
	if err := store.db.Create(&task).Error; err != nil {
		t.Fatalf("create task: %v", err)
	}
	return task
}
