package service

import (
	"os"
	"path/filepath"
	"testing"

	"imagen/backend/internal/config"
	"imagen/backend/internal/domain"
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

func TestNormalizeImageSize(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "default", want: "1024x1024"},
		{name: "explicit", input: "1536x1024", want: "1536x1024"},
		{name: "spaces", input: " 1080 X 1920 ", want: "1080x1920"},
		{name: "bad format", input: "portrait", wantErr: true},
		{name: "too small", input: "128x128", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeImageSize(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatal("normalizeImageSize() error = nil, want error")
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeImageSize() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("normalizeImageSize() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBillableImageCount(t *testing.T) {
	if got := billableImageCount(domain.TaskFailed, 4, 4); got != 0 {
		t.Fatalf("failed billable = %d, want 0", got)
	}
	if got := billableImageCount(domain.TaskSucceeded, 4, 2); got != 2 {
		t.Fatalf("partial billable = %d, want 2", got)
	}
	if got := billableImageCount(domain.TaskSucceeded, 4, 6); got != 4 {
		t.Fatalf("over-output billable = %d, want 4", got)
	}
}
