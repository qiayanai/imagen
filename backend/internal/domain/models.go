package domain

import (
	"time"
)

const (
	APIKeyActive   = "active"
	APIKeyDisabled = "disabled"

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
)

type JSON = []byte

type APIKey struct {
	ID              string `gorm:"primaryKey;size:64"`
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
