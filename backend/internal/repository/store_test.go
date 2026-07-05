package repository

import (
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
