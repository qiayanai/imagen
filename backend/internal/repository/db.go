package repository

import (
	"os"
	"path/filepath"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"imagen/backend/internal/domain"
)

func Open(databaseDSN, path string) (*gorm.DB, error) {
	if dsn := strings.TrimSpace(databaseDSN); dsn != "" {
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
		if err != nil {
			return nil, err
		}
		sqlDB, err := db.DB()
		if err != nil {
			return nil, err
		}
		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetMaxIdleConns(5)
		return db, nil
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(1)
	_ = db.Exec("PRAGMA journal_mode=WAL").Error
	_ = db.Exec("PRAGMA busy_timeout=5000").Error
	return db, nil
}

func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&domain.APIKey{},
		&domain.ProviderAccount{},
		&domain.ImageTask{},
		&domain.ImageBatch{},
	)
}
