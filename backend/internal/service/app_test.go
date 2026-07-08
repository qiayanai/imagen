package service

import (
	"os"
	"path/filepath"
	"testing"

	"imagen/backend/internal/config"
)

func TestEnsureRuntimeDirsCreatesRunnerDirectories(t *testing.T) {
	root := t.TempDir()
	cfg := config.Config{
		StorageDir:    filepath.Join(root, "storage"),
		EngineHomeDir: filepath.Join(root, "engines"),
		WorkDir:       filepath.Join(root, "work"),
	}

	if err := ensureRuntimeDirs(cfg); err != nil {
		t.Fatalf("ensureRuntimeDirs() error = %v", err)
	}
	for _, path := range []string{cfg.StorageDir, cfg.EngineHomeDir, cfg.WorkDir} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatalf("stat %s: %v", path, err)
		}
		if !info.IsDir() {
			t.Fatalf("%s is not a directory", path)
		}
	}
}
