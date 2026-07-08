package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
	"imagen/backend/internal/config"
	"imagen/backend/internal/domain"
	"imagen/backend/internal/repository"
	"imagen/backend/internal/service"
)

type legacyAsset struct {
	ID               string
	Title            string
	Description      string
	OriginalPrompt   string
	NormalizedPrompt string
	PromptLanguage   string
	Category         string
	TagsJSON         []byte
	PublicURL        string
	Width            int
	Height           int
	Bytes            int64
	SHA256           string
	ReviewScore      float64
	ReviewFlagsJSON  []byte
	ReviewSummary    string
	GenerationModel  string
	RequestedSize    string
	CreatedAt        string
}

func main() {
	source := flag.String("source", "/Users/beiluo/Documents/work/code/gitee.com/gpt-image-2-data-pipeline/data/product.sqlite", "legacy product.sqlite path")
	limit := flag.Int("limit", 50, "number of assets to inspect/import")
	offset := flag.Int("offset", 0, "offset into the candidate list")
	minScore := flag.Float64("min-score", 0.9, "minimum review score")
	includeFlags := flag.Bool("include-flags", false, "include assets with review flags")
	publishPolicy := flag.String("publish-policy", "safe", "publish policy: safe, all, or draft")
	publishMinScore := flag.Float64("publish-min-score", 0.9, "minimum score for safe published assets")
	skipExisting := flag.Bool("skip-existing", true, "skip assets already imported by legacy id")
	apply := flag.Bool("apply", false, "download, upload, and write records")
	tmpDir := flag.String("tmp-dir", "data/import-tmp", "temporary download directory")
	promptLanguage := flag.String("prompt-language", "", "only include legacy assets with this prompt_language, for example en")
	englishTitleFallback := flag.Bool("english-title-fallback", false, "when -prompt-language=en, also include blank-language assets whose title starts with an ASCII letter")
	createdAfter := flag.String("created-after", "", "only include legacy assets created at or after this timestamp")
	createdBefore := flag.String("created-before", "", "only include legacy assets created before this timestamp")
	flag.Parse()
	if _, err := statusForAsset(legacyAsset{}, *publishPolicy, *publishMinScore); err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	assets, total, err := loadLegacyAssets(legacyAssetFilter{
		Source:               *source,
		MinScore:             *minScore,
		IncludeFlags:         *includeFlags,
		Limit:                *limit,
		Offset:               *offset,
		PromptLanguage:       *promptLanguage,
		EnglishTitleFallback: *englishTitleFallback,
		CreatedAfter:         *createdAfter,
		CreatedBefore:        *createdBefore,
	})
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("legacy candidates=%d showing=%d offset=%d min_score=%.2f include_flags=%v prompt_language=%q created_after=%q created_before=%q publish_policy=%s apply=%v", total, len(assets), *offset, *minScore, *includeFlags, *promptLanguage, *createdAfter, *createdBefore, *publishPolicy, *apply)
	if !*apply {
		for index, asset := range assets {
			status, _ := statusForAsset(asset, *publishPolicy, *publishMinScore)
			log.Printf("[%02d] %s | %s | lang=%s | created=%s | score=%.2f | status=%s | %s", index+1, asset.Title, asset.Category, asset.PromptLanguage, asset.CreatedAt, asset.ReviewScore, status, asset.PublicURL)
		}
		return
	}

	cfg := config.FromEnv()
	targetDB, err := repository.Open(cfg.DatabaseDSN, cfg.DBPath)
	if err != nil {
		log.Fatal(err)
	}
	if err := repository.Migrate(targetDB); err != nil {
		log.Fatal(err)
	}
	app, err := service.New(repository.NewStore(targetDB), cfg)
	if err != nil {
		log.Fatal(err)
	}
	if err := os.MkdirAll(*tmpDir, 0o755); err != nil {
		log.Fatal(err)
	}

	imported := 0
	skipped := 0
	for index, asset := range assets {
		result, err := importOne(ctx, app, asset, *tmpDir, *publishPolicy, *publishMinScore, *skipExisting)
		if err != nil {
			log.Printf("[%02d] error %s: %v", index+1, asset.ID, err)
			continue
		}
		if result == "skipped" {
			skipped++
			log.Printf("[%02d] skipped %s | %s", index+1, asset.ID, asset.Title)
			continue
		}
		imported++
		log.Printf("[%02d] imported %s | %s | status=%s", index+1, asset.ID, asset.Title, result)
	}
	log.Printf("done imported=%d skipped=%d failed=%d", imported, skipped, len(assets)-imported-skipped)
}

type legacyAssetFilter struct {
	Source               string
	MinScore             float64
	IncludeFlags         bool
	Limit                int
	Offset               int
	PromptLanguage       string
	EnglishTitleFallback bool
	CreatedAfter         string
	CreatedBefore        string
}

func loadLegacyAssets(filter legacyAssetFilter) ([]legacyAsset, int64, error) {
	sourceAbs, err := filepath.Abs(filter.Source)
	if err != nil {
		return nil, 0, err
	}
	db, err := sql.Open("sqlite3", sourceAbs)
	if err != nil {
		return nil, 0, err
	}
	defer db.Close()
	if filter.Limit <= 0 || filter.Limit > 500 {
		filter.Limit = 50
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}
	conditions := []string{
		"status = 'published'",
		"upload_status = 'uploaded'",
		"coalesce(public_url, '') <> ''",
		"coalesce(original_prompt, '') <> ''",
		"coalesce(sha256, '') <> ''",
		"coalesce(review_score, 0) >= ?",
	}
	args := []any{filter.MinScore}
	if !filter.IncludeFlags {
		conditions = append(conditions, "(review_flags_json is null or review_flags_json = '' or review_flags_json = 'null' or review_flags_json = '[]')")
	}
	if lang := strings.ToLower(strings.TrimSpace(filter.PromptLanguage)); lang != "" {
		if lang == "en" && filter.EnglishTitleFallback {
			conditions = append(conditions, "(lower(coalesce(prompt_language, '')) = ? or (coalesce(prompt_language, '') = '' and title glob '[A-Za-z]*'))")
			args = append(args, lang)
		} else {
			conditions = append(conditions, "lower(coalesce(prompt_language, '')) = ?")
			args = append(args, lang)
		}
	}
	if createdAfter := strings.TrimSpace(filter.CreatedAfter); createdAfter != "" {
		conditions = append(conditions, "created_at >= ?")
		args = append(args, createdAfter)
	}
	if createdBefore := strings.TrimSpace(filter.CreatedBefore); createdBefore != "" {
		conditions = append(conditions, "created_at < ?")
		args = append(args, createdBefore)
	}
	where := "where " + strings.Join(conditions, "\n  and ")

	var total int64
	if err := db.QueryRow("select count(*) from image_assets "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	queryArgs := append([]any{}, args...)
	queryArgs = append(queryArgs, filter.Limit, filter.Offset)
	rows, err := db.Query(`
select id, title, description, original_prompt, normalized_prompt, prompt_language, category,
       tags_json, public_url, width, height, bytes, sha256, review_score, review_flags_json,
       review_summary, generation_model, requested_size, created_at
from image_assets `+where+`
order by review_score desc, created_at desc
limit ? offset ?`, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	assets := []legacyAsset{}
	for rows.Next() {
		var item legacyAsset
		var title, description, normalizedPrompt, promptLanguage, category, tagsJSON sql.NullString
		var publicURL, shaValue, reviewFlagsJSON, reviewSummary, generationModel, requestedSize sql.NullString
		var width, height sql.NullInt64
		var bytesValue sql.NullInt64
		var reviewScore sql.NullFloat64
		if err := rows.Scan(
			&item.ID,
			&title,
			&description,
			&item.OriginalPrompt,
			&normalizedPrompt,
			&promptLanguage,
			&category,
			&tagsJSON,
			&publicURL,
			&width,
			&height,
			&bytesValue,
			&shaValue,
			&reviewScore,
			&reviewFlagsJSON,
			&reviewSummary,
			&generationModel,
			&requestedSize,
			&item.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		item.Title = stringOrDefault(title, item.ID)
		item.Description = description.String
		item.NormalizedPrompt = normalizedPrompt.String
		item.PromptLanguage = promptLanguage.String
		item.Category = stringOrDefault(category, "Uncategorized")
		item.TagsJSON = normalizeJSONArray(tagsJSON.String)
		item.PublicURL = publicURL.String
		item.Width = int(width.Int64)
		item.Height = int(height.Int64)
		item.Bytes = bytesValue.Int64
		item.SHA256 = strings.ToLower(strings.TrimSpace(shaValue.String))
		item.ReviewScore = reviewScore.Float64
		item.ReviewFlagsJSON = normalizeJSONArray(reviewFlagsJSON.String)
		item.ReviewSummary = reviewSummary.String
		item.GenerationModel = generationModel.String
		item.RequestedSize = requestedSize.String
		assets = append(assets, item)
	}
	return assets, total, rows.Err()
}

func importOne(ctx context.Context, app *service.App, asset legacyAsset, tmpDir, publishPolicy string, publishMinScore float64, skipExisting bool) (string, error) {
	if skipExisting {
		if _, err := app.Repo.GetLibraryAssetByLegacyID(ctx, asset.ID); err == nil {
			return "skipped", nil
		} else if !repository.IsNotFound(err) {
			return "", err
		}
	}
	status, err := statusForAsset(asset, publishPolicy, publishMinScore)
	if err != nil {
		return "", err
	}
	ext := extensionForURL(asset.PublicURL)
	if ext == "" {
		ext = ".png"
	}
	tempPath := filepath.Join(tmpDir, safeObjectPart(asset.ID)+"_"+shortHash(asset.SHA256)+ext)
	if err := downloadFile(ctx, asset.PublicURL, tempPath); err != nil {
		return "", err
	}
	computedSHA, err := fileSHA256(tempPath)
	if err != nil {
		return "", err
	}
	shaValue := asset.SHA256
	if shaValue == "" {
		shaValue = computedSHA
	} else if computedSHA != "" && !strings.EqualFold(computedSHA, shaValue) {
		log.Printf("warning: sha mismatch legacy=%s computed=%s id=%s", shaValue, computedSHA, asset.ID)
		shaValue = computedSHA
	}
	key := strings.Join([]string{
		"library",
		"imported",
		shortPrefix(shaValue),
		safeObjectPart(asset.ID) + "_" + shortHash(shaValue) + ext,
	}, "/")
	stored, err := app.Store.SaveLibrary(ctx, tempPath, key)
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	bytesValue := stored.Bytes
	if bytesValue == 0 {
		bytesValue = asset.Bytes
	}
	if err := app.UpsertLibraryAsset(ctx, domain.LibraryAsset{
		ID:               libraryID(asset.ID),
		LegacyAssetID:    asset.ID,
		Title:            asset.Title,
		Description:      asset.Description,
		OriginalPrompt:   strings.TrimSpace(asset.OriginalPrompt),
		NormalizedPrompt: strings.TrimSpace(asset.NormalizedPrompt),
		PromptLanguage:   strings.TrimSpace(asset.PromptLanguage),
		Category:         strings.TrimSpace(asset.Category),
		TagsJSON:         asset.TagsJSON,
		Status:           status,
		Source:           "legacy_pipeline",
		SourceURL:        asset.PublicURL,
		StorageProvider:  stored.Provider,
		StorageKey:       stored.Key,
		PublicURL:        stored.URL,
		Width:            asset.Width,
		Height:           asset.Height,
		Bytes:            bytesValue,
		SHA256:           shaValue,
		ReviewScore:      asset.ReviewScore,
		ReviewFlagsJSON:  asset.ReviewFlagsJSON,
		ReviewSummary:    asset.ReviewSummary,
		GenerationModel:  asset.GenerationModel,
		RequestedSize:    asset.RequestedSize,
		ImportedAt:       &now,
	}); err != nil {
		return "", err
	}
	return status, nil
}

func downloadFile(ctx context.Context, sourceURL, targetPath string) error {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		if err := downloadFileOnce(ctx, sourceURL, targetPath); err != nil {
			lastErr = err
			if attempt < 3 {
				time.Sleep(time.Duration(attempt*2) * time.Second)
			}
			continue
		}
		return nil
	}
	return lastErr
}

func downloadFileOnce(ctx context.Context, sourceURL, targetPath string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("download %s: status %d", sourceURL, resp.StatusCode)
	}
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return err
	}
	partPath := targetPath + ".part"
	out, err := os.Create(partPath)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, resp.Body)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(partPath)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(partPath)
		return closeErr
	}
	return os.Rename(partPath, targetPath)
}

func fileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func normalizeJSONArray(raw string) []byte {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.EqualFold(raw, "null") {
		return []byte("[]")
	}
	var value []string
	if err := json.Unmarshal([]byte(raw), &value); err == nil {
		normalized, _ := json.Marshal(value)
		return normalized
	}
	return []byte("[]")
}

func statusForAsset(asset legacyAsset, policy string, publishMinScore float64) (string, error) {
	switch strings.ToLower(strings.TrimSpace(policy)) {
	case "", "safe":
		if safeForPublish(asset, publishMinScore) {
			return domain.LibraryAssetPublished, nil
		}
		return domain.LibraryAssetDraft, nil
	case "all", "published":
		return domain.LibraryAssetPublished, nil
	case "draft":
		return domain.LibraryAssetDraft, nil
	default:
		return "", fmt.Errorf("invalid publish policy %q", policy)
	}
}

func safeForPublish(asset legacyAsset, publishMinScore float64) bool {
	return asset.ReviewScore >= publishMinScore && jsonStringCount(asset.ReviewFlagsJSON) == 0
}

func jsonStringCount(raw []byte) int {
	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return 0
	}
	return len(values)
}

func stringOrDefault(value sql.NullString, fallback string) string {
	if strings.TrimSpace(value.String) == "" {
		return fallback
	}
	return value.String
}

func extensionForURL(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	ext := strings.ToLower(filepath.Ext(parsed.Path))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp":
		return ext
	default:
		return ""
	}
}

func libraryID(legacyID string) string {
	clean := strings.TrimPrefix(safeObjectPart(legacyID), "asset_")
	if clean == "" {
		clean = uuid.NewString()
	}
	return "lib_" + clean
}

func safeObjectPart(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, value)
	value = strings.Trim(value, "-_")
	if value == "" {
		return "asset"
	}
	return value
}

func shortHash(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if len(value) > 12 {
		return value[:12]
	}
	if value == "" {
		return "unknown"
	}
	return value
}

func shortPrefix(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if len(value) >= 2 {
		return value[:2]
	}
	return "xx"
}
