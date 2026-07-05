package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const runnerAuthFileName = "auth.json"

func installRunnerAuth(engineHome, authJSON string) error {
	authJSON = strings.TrimSpace(authJSON)
	if authJSON == "" {
		return nil
	}
	engineHome = strings.TrimSpace(engineHome)
	if engineHome == "" {
		return errors.New("engine_home is required when runner_auth_json is provided")
	}
	data, err := normalizeRunnerAuthJSON(authJSON)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(engineHome, 0o700); err != nil {
		return fmt.Errorf("create engine home: %w", err)
	}
	if err := os.Chmod(engineHome, 0o700); err != nil {
		return fmt.Errorf("chmod engine home: %w", err)
	}
	tmp, err := os.CreateTemp(engineHome, ".auth.json.")
	if err != nil {
		return fmt.Errorf("create auth temp file: %w", err)
	}
	tmpName := tmp.Name()
	defer func() {
		_ = os.Remove(tmpName)
	}()
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("chmod auth temp file: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("write auth file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close auth file: %w", err)
	}
	target := filepath.Join(engineHome, runnerAuthFileName)
	if err := os.Rename(tmpName, target); err != nil {
		return fmt.Errorf("install auth file: %w", err)
	}
	if err := os.Chmod(target, 0o600); err != nil {
		return fmt.Errorf("chmod auth file: %w", err)
	}
	return nil
}

func normalizeRunnerAuthJSON(authJSON string) ([]byte, error) {
	var payload map[string]any
	if err := json.Unmarshal([]byte(authJSON), &payload); err != nil {
		return nil, fmt.Errorf("invalid runner auth json: %w", err)
	}
	if len(payload) == 0 {
		return nil, errors.New("invalid runner auth json: empty object")
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("normalize runner auth json: %w", err)
	}
	return append(data, '\n'), nil
}

func RunnerAuthConfigured(engineHome string) bool {
	engineHome = strings.TrimSpace(engineHome)
	if engineHome == "" {
		return false
	}
	info, err := os.Stat(filepath.Join(engineHome, runnerAuthFileName))
	return err == nil && !info.IsDir()
}
