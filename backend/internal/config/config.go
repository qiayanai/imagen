package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr                string
	DatabaseDSN         string
	DBPath              string
	PublicBaseURL       string
	WebBaseURL          string
	CORSAllowedOrigins  []string
	AdminToken          string
	SessionSecret       string
	SessionCookieDomain string
	SecretKey           string
	StorageDir          string
	StorageProvider     string
	EngineHomeDir       string
	WorkDir             string
	RunnerPath          string
	RunnerModel         string
	Workers             int
	TaskTimeout         time.Duration
	MaxImagesPerTask    int
	DefaultKeyImageCap  int
	DefaultAccountLimit int
	R2AccountID         string
	R2AccessKeyID       string
	R2SecretAccessKey   string
	R2Bucket            string
	R2PublicBaseURL     string
	R2KeyPrefix         string
	GoogleClientID      string
	GoogleClientSecret  string
	GoogleRedirectURL   string
	AdminAllowedEmails  []string
	AdminAllowedDomains []string
}

func FromEnv() Config {
	loadEnvFile(firstNonEmpty(os.Getenv("IMAGEGEN_CONFIG_FILE"), "config/local.env"))
	return Config{
		Addr:                env("IMAGEGEN_ADDR", "127.0.0.1:8092"),
		DatabaseDSN:         env("IMAGEGEN_DATABASE_DSN", ""),
		DBPath:              env("IMAGEGEN_DB", "data/imagegen.sqlite"),
		PublicBaseURL:       strings.TrimRight(env("IMAGEGEN_PUBLIC_BASE_URL", "http://127.0.0.1:8092"), "/"),
		WebBaseURL:          strings.TrimRight(env("IMAGEGEN_WEB_BASE_URL", "http://127.0.0.1:4102"), "/"),
		CORSAllowedOrigins:  csvEnvDefault("IMAGEGEN_CORS_ORIGINS", env("IMAGEGEN_WEB_BASE_URL", "http://127.0.0.1:4102")),
		AdminToken:          env("IMAGEGEN_ADMIN_TOKEN", "dev-admin-token"),
		SessionSecret:       env("IMAGEGEN_SESSION_SECRET", env("IMAGEGEN_ADMIN_TOKEN", "dev-admin-token")),
		SessionCookieDomain: env("IMAGEGEN_SESSION_COOKIE_DOMAIN", ""),
		SecretKey:           env("IMAGEGEN_SECRET_KEY", env("IMAGEGEN_SESSION_SECRET", env("IMAGEGEN_ADMIN_TOKEN", "dev-admin-token"))),
		StorageDir:          env("IMAGEGEN_STORAGE_DIR", "data/storage"),
		StorageProvider:     strings.ToLower(env("IMAGEGEN_STORAGE_PROVIDER", "local")),
		EngineHomeDir:       env("IMAGEGEN_ENGINE_HOME_DIR", "data/engines"),
		WorkDir:             env("IMAGEGEN_WORKDIR", "."),
		RunnerPath:          env("IMAGEGEN_RUNNER_PATH", "imagen-runner"),
		RunnerModel:         env("IMAGEGEN_RUNNER_MODEL", ""),
		Workers:             envInt("IMAGEGEN_WORKERS", 2),
		TaskTimeout:         time.Duration(envInt("IMAGEGEN_TASK_TIMEOUT_SECONDS", 900)) * time.Second,
		MaxImagesPerTask:    envInt("IMAGEGEN_MAX_IMAGES_PER_TASK", 10),
		DefaultKeyImageCap:  envInt("IMAGEGEN_DEFAULT_KEY_IMAGE_CAP", 100),
		DefaultAccountLimit: envInt("IMAGEGEN_DEFAULT_ACCOUNT_CONCURRENCY", 1),
		R2AccountID:         env("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:       env("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey:   env("R2_SECRET_ACCESS_KEY", ""),
		R2Bucket:            env("R2_BUCKET", ""),
		R2PublicBaseURL:     strings.TrimRight(env("R2_PUBLIC_BASE_URL", ""), "/"),
		R2KeyPrefix:         strings.Trim(env("R2_KEY_PREFIX", "imagegen/"), "/"),
		GoogleClientID:      env("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:  env("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:   env("GOOGLE_REDIRECT_URL", ""),
		AdminAllowedEmails:  csvEnv("ADMIN_ALLOWED_EMAILS"),
		AdminAllowedDomains: csvEnv("ADMIN_ALLOWED_DOMAINS"),
	}
}

func loadEnvFile(path string) {
	file, err := os.Open(strings.TrimSpace(path))
	if err != nil {
		return
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		value := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func csvEnv(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	return splitCSV(raw)
}

func csvEnvDefault(key, fallback string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		raw = fallback
	}
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	return splitCSV(raw)
}

func splitCSV(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimRight(strings.TrimSpace(part), "/")
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
