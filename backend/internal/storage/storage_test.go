package storage

import "testing"

func TestNewR2RequiresAbsolutePublicBaseURL(t *testing.T) {
	_, err := NewR2(R2Config{
		AccountID:       "account",
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		Bucket:          "bucket",
		PublicBaseURL:   "ai_image_gen",
		KeyPrefix:       "ai_image_gen",
	})
	if err == nil {
		t.Fatal("expected non-URL public base URL to be rejected")
	}
}

func TestNewR2TrimsPublicBaseURL(t *testing.T) {
	store, err := NewR2(R2Config{
		AccountID:       "account",
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		Bucket:          "bucket",
		PublicBaseURL:   "https://cdn.imagen.chat/",
		KeyPrefix:       "ai_image_gen/",
	})
	if err != nil {
		t.Fatalf("NewR2 returned error: %v", err)
	}
	if store.publicBaseURL != "https://cdn.imagen.chat" {
		t.Fatalf("unexpected public base URL %q", store.publicBaseURL)
	}
	if store.keyPrefix != "ai_image_gen" {
		t.Fatalf("unexpected key prefix %q", store.keyPrefix)
	}
}
