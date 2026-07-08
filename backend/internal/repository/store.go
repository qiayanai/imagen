package repository

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"imagen/backend/internal/domain"
)

var ErrNoProviderAccount = errors.New("no provider account is currently available")

type Store struct {
	db *gorm.DB
}

type Overview struct {
	TaskCounts        map[string]int64
	TotalTasks        int64
	TotalOutputImages int64
	Customers         int64
	APIKeys           int64
	LibraryAssets     int64
	ProviderAccounts  int64
}

type LibraryAssetFilter struct {
	Status   string
	Category string
	Query    string
	Featured *bool
	Limit    int
	Offset   int
}

type CategoryCount struct {
	Category string
	Count    int64
}

func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

func (s *Store) ProviderAccountCount(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&domain.ProviderAccount{}).Count(&count).Error
	return count, err
}

func (s *Store) CreateCustomer(ctx context.Context, customer domain.Customer) error {
	return s.db.WithContext(ctx).Create(&customer).Error
}

func (s *Store) ListCustomers(ctx context.Context) ([]domain.Customer, error) {
	var customers []domain.Customer
	err := s.db.WithContext(ctx).Order("created_at desc").Find(&customers).Error
	return customers, err
}

func (s *Store) GetCustomer(ctx context.Context, id string) (domain.Customer, error) {
	var customer domain.Customer
	err := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&customer).Error
	return customer, err
}

func (s *Store) GetCustomerByPortalKeyHash(ctx context.Context, hash string) (domain.Customer, error) {
	var customer domain.Customer
	err := s.db.WithContext(ctx).Where("portal_key_hash = ?", strings.TrimSpace(hash)).First(&customer).Error
	return customer, err
}

func (s *Store) GetCustomerByEmail(ctx context.Context, email string) (domain.Customer, error) {
	var customer domain.Customer
	err := s.db.WithContext(ctx).
		Where("lower(email) = ?", strings.ToLower(strings.TrimSpace(email))).
		Order("created_at desc").
		First(&customer).Error
	return customer, err
}

func (s *Store) UpdateCustomer(ctx context.Context, id string, updates map[string]any) (domain.Customer, error) {
	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(&domain.Customer{}).Where("id = ?", strings.TrimSpace(id)).Updates(updates).Error; err != nil {
			return domain.Customer{}, err
		}
	}
	return s.GetCustomer(ctx, id)
}

func (s *Store) DeleteCustomer(ctx context.Context, id string) error {
	id = strings.TrimSpace(id)
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var customer domain.Customer
		if err := tx.Where("id = ?", id).First(&customer).Error; err != nil {
			return err
		}
		var keyIDs []string
		if err := tx.Model(&domain.APIKey{}).Where("customer_id = ?", id).Pluck("id", &keyIDs).Error; err != nil {
			return err
		}
		if len(keyIDs) > 0 {
			if err := tx.Where("api_key_id in ?", keyIDs).Delete(&domain.ImageTask{}).Error; err != nil {
				return err
			}
			if err := tx.Where("api_key_id in ?", keyIDs).Delete(&domain.ImageBatch{}).Error; err != nil {
				return err
			}
			if err := tx.Where("id in ?", keyIDs).Delete(&domain.APIKey{}).Error; err != nil {
				return err
			}
		}
		res := tx.Where("id = ?", id).Delete(&domain.Customer{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (s *Store) CreateAPIKey(ctx context.Context, key domain.APIKey) error {
	return s.db.WithContext(ctx).Create(&key).Error
}

func (s *Store) ListAPIKeys(ctx context.Context) ([]domain.APIKey, error) {
	var keys []domain.APIKey
	err := s.db.WithContext(ctx).Order("created_at desc").Find(&keys).Error
	return keys, err
}

func (s *Store) ListAPIKeysByCustomer(ctx context.Context, customerID string) ([]domain.APIKey, error) {
	var keys []domain.APIKey
	err := s.db.WithContext(ctx).Where("customer_id = ?", strings.TrimSpace(customerID)).Order("created_at desc").Find(&keys).Error
	return keys, err
}

func (s *Store) GetAPIKey(ctx context.Context, id string) (domain.APIKey, error) {
	var key domain.APIKey
	err := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&key).Error
	return key, err
}

func (s *Store) GetAPIKeyForCustomer(ctx context.Context, customerID, keyID string) (domain.APIKey, error) {
	var key domain.APIKey
	err := s.db.WithContext(ctx).Where("id = ? and customer_id = ?", strings.TrimSpace(keyID), strings.TrimSpace(customerID)).First(&key).Error
	return key, err
}

func (s *Store) GetAPIKeyByHash(ctx context.Context, hash string) (domain.APIKey, error) {
	var key domain.APIKey
	err := s.db.WithContext(ctx).Where("key_hash = ?", strings.TrimSpace(hash)).First(&key).Error
	return key, err
}

func (s *Store) TouchAPIKey(ctx context.Context, key domain.APIKey, now time.Time) error {
	updates := map[string]any{"last_used_at": &now}
	if key.CurrentDay != utcDay(now) {
		updates["current_day"] = utcDay(now)
		updates["image_used_daily"] = 0
	}
	return s.db.WithContext(ctx).Model(&domain.APIKey{}).Where("id = ?", key.ID).Updates(updates).Error
}

func (s *Store) UpdateAPIKey(ctx context.Context, id string, updates map[string]any) (domain.APIKey, error) {
	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(&domain.APIKey{}).Where("id = ?", strings.TrimSpace(id)).Updates(updates).Error; err != nil {
			return domain.APIKey{}, err
		}
	}
	return s.GetAPIKey(ctx, id)
}

func (s *Store) DeleteAPIKey(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).Delete(&domain.APIKey{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) DeleteAPIKeyForCustomer(ctx context.Context, customerID, keyID string) error {
	res := s.db.WithContext(ctx).
		Where("id = ? and customer_id = ?", strings.TrimSpace(keyID), strings.TrimSpace(customerID)).
		Delete(&domain.APIKey{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) GetSystemSetting(ctx context.Context, key string) (string, bool, error) {
	var setting domain.SystemSetting
	err := s.db.WithContext(ctx).Where("key = ?", strings.TrimSpace(key)).First(&setting).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return setting.Value, true, nil
}

func (s *Store) SetSystemSetting(ctx context.Context, key, value string) error {
	setting := domain.SystemSetting{
		Key:   strings.TrimSpace(key),
		Value: strings.TrimSpace(value),
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&setting).Error
}

func (s *Store) UpsertLibraryAsset(ctx context.Context, asset domain.LibraryAsset) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "legacy_asset_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"title",
			"description",
			"original_prompt",
			"normalized_prompt",
			"prompt_language",
			"category",
			"tags_json",
			"status",
			"source",
			"source_url",
			"storage_provider",
			"storage_key",
			"public_url",
			"width",
			"height",
			"bytes",
			"sha256",
			"review_score",
			"review_flags_json",
			"review_summary",
			"generation_model",
			"requested_size",
			"imported_at",
			"updated_at",
		}),
	}).Create(&asset).Error
}

func (s *Store) GetLibraryAssetBySHA(ctx context.Context, sha string) (domain.LibraryAsset, error) {
	var asset domain.LibraryAsset
	err := s.db.WithContext(ctx).Where("sha256 = ?", strings.TrimSpace(sha)).First(&asset).Error
	return asset, err
}

func (s *Store) GetLibraryAssetByLegacyID(ctx context.Context, legacyID string) (domain.LibraryAsset, error) {
	var asset domain.LibraryAsset
	err := s.db.WithContext(ctx).Where("legacy_asset_id = ?", strings.TrimSpace(legacyID)).First(&asset).Error
	return asset, err
}

func (s *Store) ListLibraryAssets(ctx context.Context, filter LibraryAssetFilter) ([]domain.LibraryAsset, int64, error) {
	status := strings.TrimSpace(filter.Status)
	if status == "" {
		status = domain.LibraryAssetPublished
	}
	q := s.db.WithContext(ctx).Model(&domain.LibraryAsset{}).Where("status = ?", status)
	if category := strings.TrimSpace(filter.Category); category != "" && category != "all" {
		q = q.Where("category = ?", category)
	}
	if query := strings.ToLower(strings.TrimSpace(filter.Query)); query != "" {
		like := "%" + query + "%"
		q = q.Where("lower(title) like ? or lower(original_prompt) like ? or lower(category) like ?", like, like, like)
	}
	if filter.Featured != nil {
		q = q.Where("featured = ?", *filter.Featured)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}
	var assets []domain.LibraryAsset
	err := q.Order("featured desc, review_score desc, created_at desc").Limit(limit).Offset(offset).Find(&assets).Error
	return assets, total, err
}

func (s *Store) UpdateLibraryAssetFeatured(ctx context.Context, id string, featured bool) (domain.LibraryAsset, error) {
	if err := s.db.WithContext(ctx).
		Model(&domain.LibraryAsset{}).
		Where("id = ?", strings.TrimSpace(id)).
		Update("featured", featured).Error; err != nil {
		return domain.LibraryAsset{}, err
	}
	var asset domain.LibraryAsset
	err := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&asset).Error
	return asset, err
}

func (s *Store) LibraryAssetCategories(ctx context.Context) ([]CategoryCount, error) {
	var rows []CategoryCount
	err := s.db.WithContext(ctx).
		Model(&domain.LibraryAsset{}).
		Select("category, count(*) as count").
		Where("status = ?", domain.LibraryAssetPublished).
		Group("category").
		Order("count desc").
		Scan(&rows).Error
	return rows, err
}

func (s *Store) CreateTaskWithQuota(ctx context.Context, keyID string, task domain.ImageTask, images, newTasks int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := reserveQuota(tx, keyID, images, newTasks); err != nil {
			return err
		}
		return tx.Create(&task).Error
	})
}

func (s *Store) CreateBatchWithQuota(ctx context.Context, keyID string, batch domain.ImageBatch, tasks []domain.ImageTask, images int) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := reserveQuota(tx, keyID, images, len(tasks)); err != nil {
			return err
		}
		if err := tx.Create(&batch).Error; err != nil {
			return err
		}
		for _, task := range tasks {
			if err := tx.Create(&task).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) GetTask(ctx context.Context, keyID, taskID string) (domain.ImageTask, error) {
	var task domain.ImageTask
	err := s.db.WithContext(ctx).Where("id = ? and api_key_id = ?", strings.TrimSpace(taskID), keyID).First(&task).Error
	return task, err
}

func (s *Store) ListTasks(ctx context.Context, keyID, status string, limit, offset int) ([]domain.ImageTask, int64, error) {
	q := s.db.WithContext(ctx).Model(&domain.ImageTask{}).Where("api_key_id = ?", keyID)
	if strings.TrimSpace(status) != "" && status != "all" {
		q = q.Where("status = ?", strings.TrimSpace(status))
	}
	return listTasks(q, limit, offset)
}

func (s *Store) GetBatch(ctx context.Context, keyID, batchID string) (domain.ImageBatch, []domain.ImageTask, error) {
	var batch domain.ImageBatch
	if err := s.db.WithContext(ctx).Where("id = ? and api_key_id = ?", strings.TrimSpace(batchID), keyID).First(&batch).Error; err != nil {
		return domain.ImageBatch{}, nil, err
	}
	var tasks []domain.ImageTask
	err := s.db.WithContext(ctx).Where("batch_id = ? and api_key_id = ?", batch.ID, keyID).Order("created_at asc").Find(&tasks).Error
	return batch, tasks, err
}

func (s *Store) CreateProviderAccount(ctx context.Context, account domain.ProviderAccount) error {
	return s.db.WithContext(ctx).Create(&account).Error
}

func (s *Store) ListProviderAccounts(ctx context.Context) ([]domain.ProviderAccount, error) {
	var accounts []domain.ProviderAccount
	err := s.db.WithContext(ctx).Order("created_at desc").Find(&accounts).Error
	return accounts, err
}

func (s *Store) GetProviderAccount(ctx context.Context, id string) (domain.ProviderAccount, error) {
	var account domain.ProviderAccount
	err := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&account).Error
	return account, err
}

func (s *Store) UpdateProviderAccount(ctx context.Context, id string, updates map[string]any) (domain.ProviderAccount, error) {
	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(&domain.ProviderAccount{}).Where("id = ?", strings.TrimSpace(id)).Updates(updates).Error; err != nil {
			return domain.ProviderAccount{}, err
		}
	}
	return s.GetProviderAccount(ctx, id)
}

func (s *Store) DeleteProviderAccount(ctx context.Context, id string) error {
	res := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).Delete(&domain.ProviderAccount{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *Store) ClaimQueuedTask(ctx context.Context) (domain.ImageTask, bool, error) {
	var task domain.ImageTask
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("status = ?", domain.TaskQueued).Order("queued_at asc").First(&task).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		res := tx.Model(&domain.ImageTask{}).Where("id = ? and status = ?", task.ID, domain.TaskQueued).Updates(map[string]any{
			"status":     domain.TaskRunning,
			"started_at": &now,
			"attempt":    gorm.Expr("attempt + 1"),
			"error":      "",
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		task.Status = domain.TaskRunning
		task.StartedAt = &now
		task.Attempt++
		return nil
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ImageTask{}, false, nil
	}
	return task, err == nil, err
}

func (s *Store) SetTaskProviderAccount(ctx context.Context, taskID, accountID string) error {
	return s.db.WithContext(ctx).Model(&domain.ImageTask{}).Where("id = ?", taskID).Update("provider_account_id", accountID).Error
}

func (s *Store) AcquireProviderAccount(ctx context.Context, images int) (domain.ProviderAccount, error) {
	if images <= 0 {
		images = 1
	}
	var selected domain.ProviderAccount
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var accounts []domain.ProviderAccount
		q := tx.Where("status = ?", domain.AccountActive).Order("created_at asc")
		if tx.Dialector.Name() == "postgres" {
			q = q.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := q.Find(&accounts).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		account, ok, err := selectWeightedProviderAccount(accounts, images, now)
		if err != nil {
			return err
		}
		if !ok {
			return ErrNoProviderAccount
		}
		today := utcDay(now)
		updates := map[string]any{
			"running_count":    gorm.Expr("running_count + 1"),
			"daily_image_used": account.DailyImageUsed + images,
			"current_day":      today,
			"last_error":       "",
		}
		if err := tx.Model(&domain.ProviderAccount{}).Where("id = ?", account.ID).Updates(updates).Error; err != nil {
			return err
		}
		account.RunningCount++
		account.DailyImageUsed += images
		account.CurrentDay = today
		selected = account
		return nil
	})
	return selected, err
}

func selectWeightedProviderAccount(accounts []domain.ProviderAccount, images int, now time.Time) (domain.ProviderAccount, bool, error) {
	if images <= 0 {
		images = 1
	}
	today := utcDay(now)
	eligible := make([]domain.ProviderAccount, 0, len(accounts))
	totalWeight := int64(0)
	for _, account := range accounts {
		if account.CooldownUntil != nil && account.CooldownUntil.After(now) {
			continue
		}
		if account.CurrentDay != today {
			account.CurrentDay = today
			account.DailyImageUsed = 0
		}
		maxConcurrency := account.MaxConcurrency
		if maxConcurrency <= 0 {
			maxConcurrency = 1
		}
		if account.RunningCount >= maxConcurrency {
			continue
		}
		if account.DailyImageLimit > 0 && account.DailyImageUsed+images > account.DailyImageLimit {
			continue
		}
		if account.Weight <= 0 {
			continue
		}
		eligible = append(eligible, account)
		totalWeight += int64(account.Weight)
	}
	if len(eligible) == 0 || totalWeight <= 0 {
		return domain.ProviderAccount{}, false, nil
	}
	n, err := rand.Int(rand.Reader, big.NewInt(totalWeight))
	if err != nil {
		return domain.ProviderAccount{}, false, err
	}
	target := n.Int64()
	for _, account := range eligible {
		target -= int64(account.Weight)
		if target < 0 {
			return account, true, nil
		}
	}
	return eligible[len(eligible)-1], true, nil
}

func (s *Store) ReleaseProviderAccount(ctx context.Context, id string, reservedImages, billableImages int, reserveDay, errText string) error {
	if strings.TrimSpace(id) == "" {
		return nil
	}
	if reservedImages < 0 {
		reservedImages = 0
	}
	if billableImages < 0 {
		billableImages = 0
	}
	if billableImages > reservedImages {
		billableImages = reservedImages
	}
	updates := map[string]any{
		"running_count": gorm.Expr("case when running_count > 0 then running_count - 1 else 0 end"),
	}
	refund := reservedImages - billableImages
	if refund > 0 && strings.TrimSpace(reserveDay) != "" {
		updates["daily_image_used"] = gorm.Expr(
			"case when running_count > 0 and current_day = ? and daily_image_used >= ? then daily_image_used - ? when running_count > 0 and current_day = ? then 0 else daily_image_used end",
			reserveDay,
			refund,
			refund,
			reserveDay,
		)
	}
	if strings.TrimSpace(errText) != "" {
		updates["last_error"] = tailString(errText, 2000)
		if shouldCooldown(errText) {
			cooldown := time.Now().UTC().Add(10 * time.Minute)
			updates["cooldown_until"] = &cooldown
		}
	}
	return s.db.WithContext(ctx).Model(&domain.ProviderAccount{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) FinishTask(ctx context.Context, task domain.ImageTask, updates map[string]any) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current domain.ImageTask
		q := tx.Where("id = ?", task.ID)
		if tx.Dialector.Name() == "postgres" {
			q = q.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := q.First(&current).Error; err != nil {
			return err
		}
		if isTerminalTaskStatus(current.Status) {
			return nil
		}
		if err := tx.Model(&domain.ImageTask{}).Where("id = ?", current.ID).Updates(updates).Error; err != nil {
			return err
		}
		status, _ := updates["status"].(string)
		outputCount, _ := updates["output_image_count"].(int)
		if err := settleReservedQuota(tx, current, status, outputCount); err != nil {
			return err
		}
		if current.BatchID != "" {
			return refreshBatchStatus(tx, current.BatchID)
		}
		return nil
	})
}

func isTerminalTaskStatus(status string) bool {
	return status == domain.TaskSucceeded || status == domain.TaskFailed || status == domain.TaskCanceled
}

func settleReservedQuota(tx *gorm.DB, task domain.ImageTask, status string, outputCount int) error {
	reserved := task.ImageCount
	if reserved <= 0 {
		return nil
	}
	billable := outputCount
	if status != domain.TaskSucceeded {
		billable = 0
	}
	if billable < 0 {
		billable = 0
	}
	if billable > reserved {
		billable = reserved
	}
	refund := reserved - billable
	if refund <= 0 {
		return nil
	}
	taskDay := utcDay(task.QueuedAt)
	updates := map[string]any{
		"image_used_total": gorm.Expr("case when image_used_total >= ? then image_used_total - ? else 0 end", refund, refund),
	}
	if taskDay != "" {
		updates["image_used_daily"] = gorm.Expr(
			"case when current_day = ? and image_used_daily >= ? then image_used_daily - ? when current_day = ? then 0 else image_used_daily end",
			taskDay,
			refund,
			refund,
			taskDay,
		)
	}
	return tx.Model(&domain.APIKey{}).Where("id = ?", task.APIKeyID).Updates(updates).Error
}

func (s *Store) RequeueTask(ctx context.Context, taskID, errText string) error {
	return s.db.WithContext(ctx).Model(&domain.ImageTask{}).Where("id = ?", taskID).Updates(map[string]any{
		"status": domain.TaskQueued,
		"error":  tailString(errText, 2000),
	}).Error
}

func (s *Store) AdminListTasks(ctx context.Context, status string, limit, offset int) ([]domain.ImageTask, int64, error) {
	q := s.db.WithContext(ctx).Model(&domain.ImageTask{})
	if strings.TrimSpace(status) != "" && status != "all" {
		q = q.Where("status = ?", strings.TrimSpace(status))
	}
	return listTasks(q, limit, offset)
}

func (s *Store) AdminOverview(ctx context.Context) (Overview, error) {
	type row struct {
		Status string
		Count  int64
	}
	var rows []row
	if err := s.db.WithContext(ctx).Model(&domain.ImageTask{}).Select("status, count(*) as count").Group("status").Scan(&rows).Error; err != nil {
		return Overview{}, err
	}
	counts := map[string]int64{}
	total := int64(0)
	for _, item := range rows {
		counts[item.Status] = item.Count
		total += item.Count
	}
	var outputImages int64
	if err := s.db.WithContext(ctx).Model(&domain.ImageTask{}).Select("coalesce(sum(output_image_count), 0)").Scan(&outputImages).Error; err != nil {
		return Overview{}, err
	}
	var keyCount int64
	if err := s.db.WithContext(ctx).Model(&domain.APIKey{}).Count(&keyCount).Error; err != nil {
		return Overview{}, err
	}
	var customerCount int64
	if err := s.db.WithContext(ctx).Model(&domain.Customer{}).Count(&customerCount).Error; err != nil {
		return Overview{}, err
	}
	var accountCount int64
	if err := s.db.WithContext(ctx).Model(&domain.ProviderAccount{}).Count(&accountCount).Error; err != nil {
		return Overview{}, err
	}
	var libraryAssetCount int64
	if err := s.db.WithContext(ctx).Model(&domain.LibraryAsset{}).Where("status = ?", domain.LibraryAssetPublished).Count(&libraryAssetCount).Error; err != nil {
		return Overview{}, err
	}
	return Overview{
		TaskCounts:        counts,
		TotalTasks:        total,
		TotalOutputImages: outputImages,
		Customers:         customerCount,
		APIKeys:           keyCount,
		LibraryAssets:     libraryAssetCount,
		ProviderAccounts:  accountCount,
	}, nil
}

func reserveQuota(tx *gorm.DB, keyID string, images, newTasks int) error {
	if images <= 0 {
		return errors.New("image count must be positive")
	}
	var key domain.APIKey
	if err := tx.Where("id = ?", keyID).First(&key).Error; err != nil {
		return err
	}
	if key.Status != domain.APIKeyActive {
		return errors.New("api key is disabled")
	}
	today := utcDay(time.Now())
	if key.CurrentDay != today {
		key.CurrentDay = today
		key.ImageUsedDaily = 0
	}
	if key.ImageLimitTotal >= 0 && key.ImageUsedTotal+images > key.ImageLimitTotal {
		return fmt.Errorf("api key total image quota exceeded: used=%d requested=%d limit=%d", key.ImageUsedTotal, images, key.ImageLimitTotal)
	}
	if key.ImageLimitDaily > 0 && key.ImageUsedDaily+images > key.ImageLimitDaily {
		return fmt.Errorf("api key daily image quota exceeded: used=%d requested=%d limit=%d", key.ImageUsedDaily, images, key.ImageLimitDaily)
	}
	if key.MaxConcurrency > 0 {
		var active int64
		if err := tx.Model(&domain.ImageTask{}).Where("api_key_id = ? and status in ?", key.ID, []string{domain.TaskQueued, domain.TaskRunning}).Count(&active).Error; err != nil {
			return err
		}
		if int(active)+newTasks > key.MaxConcurrency {
			return fmt.Errorf("api key concurrency limit exceeded: active=%d new=%d limit=%d", active, newTasks, key.MaxConcurrency)
		}
	}
	now := time.Now().UTC()
	return tx.Model(&domain.APIKey{}).Where("id = ?", key.ID).Updates(map[string]any{
		"image_used_total": gorm.Expr("image_used_total + ?", images),
		"image_used_daily": key.ImageUsedDaily + images,
		"current_day":      today,
		"last_used_at":     &now,
	}).Error
}

func refreshBatchStatus(tx *gorm.DB, batchID string) error {
	var tasks []domain.ImageTask
	if err := tx.Where("batch_id = ?", batchID).Find(&tasks).Error; err != nil {
		return err
	}
	if len(tasks) == 0 {
		return nil
	}
	succeeded := 0
	failed := 0
	outputImages := 0
	active := 0
	for _, task := range tasks {
		outputImages += task.OutputImageCount
		switch task.Status {
		case domain.TaskSucceeded:
			succeeded++
		case domain.TaskFailed, domain.TaskCanceled:
			failed++
		case domain.TaskQueued, domain.TaskRunning:
			active++
		}
	}
	status := domain.BatchRunning
	if active == len(tasks) && succeeded == 0 && failed == 0 {
		status = domain.BatchQueued
	}
	if active == 0 {
		switch {
		case succeeded == len(tasks):
			status = domain.BatchSucceeded
		case succeeded > 0:
			status = domain.BatchPartialFailed
		default:
			status = domain.BatchFailed
		}
	}
	return tx.Model(&domain.ImageBatch{}).Where("id = ?", batchID).Updates(map[string]any{
		"status":          status,
		"succeeded_tasks": succeeded,
		"failed_tasks":    failed,
		"output_images":   outputImages,
	}).Error
}

func listTasks(q *gorm.DB, limit, offset int) ([]domain.ImageTask, int64, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var total int64
	if err := q.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tasks []domain.ImageTask
	err := q.Session(&gorm.Session{}).Order("created_at desc").Limit(limit).Offset(offset).Find(&tasks).Error
	return tasks, total, err
}

func utcDay(t time.Time) string {
	return t.UTC().Format("2006-01-02")
}

func shouldCooldown(errText string) bool {
	value := strings.ToLower(errText)
	return strings.Contains(value, "rate limit") ||
		strings.Contains(value, "429") ||
		strings.Contains(value, "quota") ||
		strings.Contains(value, "too many requests")
}

func tailString(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	return s[len(s)-max:]
}
