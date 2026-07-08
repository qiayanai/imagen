package domain

import (
	"time"
)

const (
	APIKeyActive   = "active"
	APIKeyDisabled = "disabled"

	CustomerActive   = "active"
	CustomerDisabled = "disabled"

	AccountActive   = "active"
	AccountDisabled = "disabled"

	TaskQueued    = "queued"
	TaskRunning   = "running"
	TaskSucceeded = "succeeded"
	TaskFailed    = "failed"
	TaskCanceled  = "canceled"

	BatchQueued        = "queued"
	BatchRunning       = "running"
	BatchSucceeded     = "succeeded"
	BatchPartialFailed = "partial_failed"
	BatchFailed        = "failed"

	LibraryAssetPublished = "published"
	LibraryAssetDraft     = "draft"
	LibraryAssetArchived  = "archived"
)

type JSON = []byte

type Customer struct {
	ID                     string `gorm:"primaryKey;size:64"`
	Name                   string `gorm:"size:255;not null"`
	Email                  string `gorm:"index;size:255"`
	Status                 string `gorm:"index;size:32;not null"`
	PortalKeyPrefix        string `gorm:"uniqueIndex;size:32;not null"`
	PortalKeyHash          string `gorm:"uniqueIndex;size:64;not null"`
	DefaultImageLimitTotal int
	DefaultImageLimitDaily int
	DefaultMaxConcurrency  int
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

type APIKey struct {
	ID              string `gorm:"primaryKey;size:64"`
	CustomerID      string `gorm:"index;size:64"`
	Name            string `gorm:"size:255"`
	KeyPrefix       string `gorm:"uniqueIndex;size:32;not null"`
	KeyHash         string `gorm:"uniqueIndex;size:64;not null"`
	Status          string `gorm:"index;size:32;not null"`
	ImageLimitTotal int
	ImageUsedTotal  int
	ImageLimitDaily int
	ImageUsedDaily  int
	CurrentDay      string `gorm:"index;size:16"`
	MaxConcurrency  int
	LastUsedAt      *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type ProviderAccount struct {
	ID              string `gorm:"primaryKey;size:64"`
	Name            string `gorm:"size:255"`
	Provider        string `gorm:"index;size:64;not null"`
	Status          string `gorm:"index;size:32;not null"`
	Weight          int
	MaxConcurrency  int
	RunningCount    int
	DailyImageLimit int
	DailyImageUsed  int
	CurrentDay      string `gorm:"index;size:16"`
	EngineHome      string `gorm:"size:1024"`
	EnvJSON         JSON
	LastError       string `gorm:"type:text"`
	CooldownUntil   *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type LibraryAsset struct {
	ID               string `gorm:"primaryKey;size:64"`
	LegacyAssetID    string `gorm:"uniqueIndex;size:128"`
	Title            string `gorm:"index;size:255"`
	Description      string `gorm:"type:text"`
	OriginalPrompt   string `gorm:"type:text;not null"`
	NormalizedPrompt string `gorm:"type:text"`
	PromptLanguage   string `gorm:"index;size:32"`
	Category         string `gorm:"index;size:128"`
	TagsJSON         JSON
	Status           string `gorm:"index;size:32;not null"`
	Source           string `gorm:"index;size:64"`
	SourceURL        string `gorm:"size:2048"`
	StorageProvider  string `gorm:"size:64;not null"`
	StorageKey       string `gorm:"uniqueIndex;size:512;not null"`
	PublicURL        string `gorm:"size:2048;not null"`
	Width            int
	Height           int
	Bytes            int64
	SHA256           string `gorm:"uniqueIndex;size:64;not null"`
	ReviewScore      float64
	ReviewFlagsJSON  JSON
	ReviewSummary    string `gorm:"type:text"`
	Featured         bool   `gorm:"index;not null;default:false"`
	GenerationModel  string `gorm:"size:128"`
	RequestedSize    string `gorm:"size:64"`
	ImportedAt       *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type SystemSetting struct {
	Key       string `gorm:"primaryKey;size:128"`
	Value     string `gorm:"type:text"`
	UpdatedAt time.Time
}

type ImageTask struct {
	ID                 string `gorm:"primaryKey;size:64"`
	APIKeyID           string `gorm:"index;size:64;not null"`
	BatchID            string `gorm:"index;size:64"`
	ProviderAccountID  string `gorm:"index;size:64"`
	Status             string `gorm:"index;size:32;not null"`
	Prompt             string `gorm:"type:text;not null"`
	ImageCount         int
	OutputImageCount   int
	Model              string `gorm:"size:128"`
	Size               string `gorm:"size:64"`
	Quality            string `gorm:"size:64"`
	Background         string `gorm:"size:64"`
	OutputFormat       string `gorm:"size:32"`
	Compression        int
	Moderation         string `gorm:"size:64"`
	OutputURLsJSON     JSON
	OutputPathsJSON    JSON
	Error              string `gorm:"type:text"`
	Attempt            int
	QueuedAt           time.Time `gorm:"index"`
	StartedAt          *time.Time
	FinishedAt         *time.Time
	DurationMillis     int64 `gorm:"index"`
	ProviderDurationMs int64
	Transcript         string `gorm:"type:text"`
	RequestJSON        JSON
	ResponseJSON       JSON
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type ImageBatch struct {
	ID              string `gorm:"primaryKey;size:64"`
	APIKeyID        string `gorm:"index;size:64;not null"`
	Status          string `gorm:"index;size:32;not null"`
	TotalTasks      int
	RequestedImages int
	SucceededTasks  int
	FailedTasks     int
	OutputImages    int
	Error           string `gorm:"type:text"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
