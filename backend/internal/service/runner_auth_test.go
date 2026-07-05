package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestInstallRunnerAuthWritesPrivateAuthFile(t *testing.T) {
	engineHome := t.TempDir()
	authJSON := `{"auth_mode":"chatgpt","tokens":{"refresh_token":"refresh-token"}}`

	if err := installRunnerAuth(engineHome, authJSON); err != nil {
		t.Fatalf("installRunnerAuth() error = %v", err)
	}

	authPath := filepath.Join(engineHome, "auth.json")
	info, err := os.Stat(authPath)
	if err != nil {
		t.Fatalf("stat auth.json: %v", err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("auth.json mode = %o, want 600", got)
	}
	if !RunnerAuthConfigured(engineHome) {
		t.Fatal("RunnerAuthConfigured() = false, want true")
	}
	data, err := os.ReadFile(authPath)
	if err != nil {
		t.Fatalf("read auth.json: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("auth.json is not valid json: %v", err)
	}
	if payload["auth_mode"] != "chatgpt" {
		t.Fatalf("auth_mode = %v, want chatgpt", payload["auth_mode"])
	}
}

func TestInstallRunnerAuthEmptyInputIsNoop(t *testing.T) {
	if err := installRunnerAuth("", ""); err != nil {
		t.Fatalf("installRunnerAuth() error = %v", err)
	}
}
