package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"imagen/backend/internal/config"
)

type StoredObject struct {
	Provider string
	Key      string
	URL      string
	Path     string
	Bytes    int64
}

type Store interface {
	SaveGenerated(ctx context.Context, sourcePath, taskID string, index int) (StoredObject, error)
	SaveLibrary(ctx context.Context, sourcePath, key string) (StoredObject, error)
	Provider() string
}

func New(cfg config.Config) (Store, error) {
	switch strings.ToLower(strings.TrimSpace(cfg.StorageProvider)) {
	case "", "local":
		return NewLocal(cfg.StorageDir, cfg.PublicBaseURL)
	case "r2", "s3":
		return NewR2(R2Config{
			AccountID:       cfg.R2AccountID,
			AccessKeyID:     cfg.R2AccessKeyID,
			SecretAccessKey: cfg.R2SecretAccessKey,
			Bucket:          cfg.R2Bucket,
			PublicBaseURL:   cfg.R2PublicBaseURL,
			KeyPrefix:       cfg.R2KeyPrefix,
		})
	default:
		return nil, fmt.Errorf("unsupported storage provider %q", cfg.StorageProvider)
	}
}

type Local struct {
	root      string
	publicURL string
}

func NewLocal(root, publicBaseURL string) (*Local, error) {
	if strings.TrimSpace(root) == "" {
		root = "data/storage"
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(abs, 0o755); err != nil {
		return nil, err
	}
	return &Local{root: abs, publicURL: strings.TrimRight(publicBaseURL, "/")}, nil
}

func (s *Local) Provider() string {
	return "local"
}

func (s *Local) SaveGenerated(ctx context.Context, sourcePath, taskID string, index int) (StoredObject, error) {
	sourceAbs, err := filepath.Abs(sourcePath)
	if err != nil {
		return StoredObject{}, err
	}
	info, err := os.Stat(sourceAbs)
	if err != nil {
		return StoredObject{}, err
	}
	targetPath := sourceAbs
	if !isInside(s.root, sourceAbs) {
		name := safeFileName(filepath.Base(sourceAbs), index)
		targetPath = filepath.Join(s.root, "tasks", taskID, name)
		if err := copyFile(targetPath, sourceAbs); err != nil {
			return StoredObject{}, err
		}
		if copiedInfo, err := os.Stat(targetPath); err == nil {
			info = copiedInfo
		}
	}
	rel, err := filepath.Rel(s.root, targetPath)
	if err != nil {
		return StoredObject{}, err
	}
	key := filepath.ToSlash(rel)
	return StoredObject{
		Provider: "local",
		Key:      key,
		URL:      s.publicURL + "/files/" + escapePath(key),
		Path:     targetPath,
		Bytes:    info.Size(),
	}, nil
}

func (s *Local) SaveLibrary(ctx context.Context, sourcePath, key string) (StoredObject, error) {
	_ = ctx
	sourceAbs, err := filepath.Abs(sourcePath)
	if err != nil {
		return StoredObject{}, err
	}
	info, err := os.Stat(sourceAbs)
	if err != nil {
		return StoredObject{}, err
	}
	cleanKey, err := cleanObjectKey(key)
	if err != nil {
		return StoredObject{}, err
	}
	targetPath := filepath.Join(s.root, cleanKey)
	if !isInside(s.root, sourceAbs) || sourceAbs != targetPath {
		if err := copyFile(targetPath, sourceAbs); err != nil {
			return StoredObject{}, err
		}
		if copiedInfo, err := os.Stat(targetPath); err == nil {
			info = copiedInfo
		}
	}
	return StoredObject{
		Provider: "local",
		Key:      cleanKey,
		URL:      s.publicURL + "/files/" + escapePath(cleanKey),
		Path:     targetPath,
		Bytes:    info.Size(),
	}, nil
}

type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PublicBaseURL   string
	KeyPrefix       string
}

type R2 struct {
	client        *s3.Client
	bucket        string
	publicBaseURL string
	keyPrefix     string
}

func NewR2(cfg R2Config) (*R2, error) {
	if strings.TrimSpace(cfg.AccountID) == "" {
		return nil, errors.New("R2_ACCOUNT_ID is required")
	}
	if strings.TrimSpace(cfg.AccessKeyID) == "" {
		return nil, errors.New("R2_ACCESS_KEY_ID is required")
	}
	if strings.TrimSpace(cfg.SecretAccessKey) == "" {
		return nil, errors.New("R2_SECRET_ACCESS_KEY is required")
	}
	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, errors.New("R2_BUCKET is required")
	}
	publicBaseURL := strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/")
	if publicBaseURL == "" {
		return nil, errors.New("R2_PUBLIC_BASE_URL is required")
	}
	if !isAbsoluteHTTPURL(publicBaseURL) {
		return nil, errors.New("R2_PUBLIC_BASE_URL must be an absolute http(s) URL, for example https://cdn.example.com")
	}
	endpoint := "https://" + strings.TrimSpace(cfg.AccountID) + ".r2.cloudflarestorage.com"
	awsCfg := aws.Config{
		Region:      "auto",
		Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, "")),
		EndpointResolverWithOptions: aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			return aws.Endpoint{URL: endpoint, SigningRegion: "auto"}, nil
		}),
	}
	client := s3.NewFromConfig(awsCfg)
	return &R2{
		client:        client,
		bucket:        strings.TrimSpace(cfg.Bucket),
		publicBaseURL: publicBaseURL,
		keyPrefix:     strings.Trim(strings.TrimSpace(cfg.KeyPrefix), "/"),
	}, nil
}

func LocalFilePath(root, key string) (string, error) {
	rootAbs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	clean := filepath.Clean(strings.TrimPrefix(key, "/"))
	path := filepath.Join(rootAbs, clean)
	if !strings.HasPrefix(path, rootAbs+string(os.PathSeparator)) && path != rootAbs {
		return "", errors.New("invalid file path")
	}
	return path, nil
}

func (s *R2) Provider() string {
	return "r2"
}

func (s *R2) SaveGenerated(ctx context.Context, sourcePath, taskID string, index int) (StoredObject, error) {
	file, err := os.Open(sourcePath)
	if err != nil {
		return StoredObject{}, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return StoredObject{}, err
	}
	name := safeFileName(filepath.Base(sourcePath), index)
	key := strings.Trim(strings.Join([]string{s.keyPrefix, "tasks", taskID, name}, "/"), "/")
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(name)))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return StoredObject{}, fmt.Errorf("upload to r2: %w", err)
	}
	return StoredObject{
		Provider: "r2",
		Key:      key,
		URL:      s.publicBaseURL + "/" + escapePath(key),
		Path:     sourcePath,
		Bytes:    info.Size(),
	}, nil
}

func (s *R2) SaveLibrary(ctx context.Context, sourcePath, key string) (StoredObject, error) {
	cleanKey, err := cleanObjectKey(key)
	if err != nil {
		return StoredObject{}, err
	}
	fullKey := strings.Trim(strings.Join([]string{s.keyPrefix, cleanKey}, "/"), "/")
	return s.putFile(ctx, sourcePath, fullKey)
}

func (s *R2) putFile(ctx context.Context, sourcePath, key string) (StoredObject, error) {
	file, err := os.Open(sourcePath)
	if err != nil {
		return StoredObject{}, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return StoredObject{}, err
	}
	contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(key)))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return StoredObject{}, fmt.Errorf("upload to r2: %w", err)
	}
	return StoredObject{
		Provider: "r2",
		Key:      key,
		URL:      s.publicBaseURL + "/" + escapePath(key),
		Path:     sourcePath,
		Bytes:    info.Size(),
	}, nil
}

func isInside(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != "." && !strings.HasPrefix(rel, "..")
}

func safeFileName(name string, index int) string {
	ext := strings.ToLower(filepath.Ext(name))
	base := strings.TrimSuffix(name, filepath.Ext(name))
	base = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, base)
	base = strings.Trim(base, "-_")
	if base == "" {
		base = fmt.Sprintf("image-%02d", index)
	}
	if ext == "" {
		ext = ".png"
	}
	return fmt.Sprintf("%s-%d%s", base, time.Now().UTC().UnixNano(), ext)
}

func copyFile(targetPath, sourcePath string) error {
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return err
	}
	in, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

func cleanObjectKey(key string) (string, error) {
	key = filepath.ToSlash(strings.TrimSpace(strings.TrimPrefix(key, "/")))
	key = strings.Trim(key, "/")
	if key == "" {
		return "", errors.New("object key is required")
	}
	clean := filepath.ToSlash(filepath.Clean(key))
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") || strings.Contains(clean, "/../") {
		return "", errors.New("invalid object key")
	}
	return clean, nil
}

func isAbsoluteHTTPURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	return parsed.Host != "" && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

func escapePath(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
