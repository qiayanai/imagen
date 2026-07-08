package config

import (
	"reflect"
	"testing"
)

func TestCORSAllowedOriginsIncludesWebBaseURL(t *testing.T) {
	t.Setenv("IMAGEGEN_CONFIG_FILE", "/tmp/imagen-missing-test.env")
	t.Setenv("IMAGEGEN_WEB_BASE_URL", "https://imagen.example.com/")
	t.Setenv("IMAGEGEN_CORS_ORIGINS", "https://preview.example.com, https://imagen.example.com/")

	cfg := FromEnv()
	want := []string{"https://preview.example.com", "https://imagen.example.com"}
	if !reflect.DeepEqual(cfg.CORSAllowedOrigins, want) {
		t.Fatalf("CORSAllowedOrigins = %#v, want %#v", cfg.CORSAllowedOrigins, want)
	}
}

func TestCORSAllowedOriginsDefaultsToWebBaseURL(t *testing.T) {
	t.Setenv("IMAGEGEN_CONFIG_FILE", "/tmp/imagen-missing-test.env")
	t.Setenv("IMAGEGEN_WEB_BASE_URL", "https://imagen.example.com/")

	cfg := FromEnv()
	want := []string{"https://imagen.example.com"}
	if !reflect.DeepEqual(cfg.CORSAllowedOrigins, want) {
		t.Fatalf("CORSAllowedOrigins = %#v, want %#v", cfg.CORSAllowedOrigins, want)
	}
}
