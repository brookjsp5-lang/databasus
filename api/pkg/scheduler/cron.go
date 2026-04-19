package scheduler

import (
	"log"
	"sync"
	"time"

	"github.com/databasus-new/api/internal/models"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

type CronScheduler struct {
	cron     *cron.Cron
	db       *gorm.DB
	scheduler *Scheduler
	entries  map[uint]cron.EntryID
	mutex    sync.RWMutex
}

var (
	cronSchedulerInstance *CronScheduler
	cronSchedulerOnce    sync.Once
)

func NewCronScheduler(db *gorm.DB, sched *Scheduler) *CronScheduler {
	cronSchedulerOnce.Do(func() {
		cronSchedulerInstance = &CronScheduler{
			cron:     cron.New(cron.WithSeconds()),
			db:       db,
			scheduler: sched,
			entries:  make(map[uint]cron.EntryID),
		}
	})
	return cronSchedulerInstance
}

func GetCronScheduler() *CronScheduler {
	return cronSchedulerInstance
}

func (c *CronScheduler) Start() {
	log.Println("Starting cron scheduler...")
	c.loadBackupConfigs()
	go c.watchForChanges()
	c.cron.Start()
	log.Println("Cron scheduler started")
}

func (c *CronScheduler) Stop() {
	log.Println("Stopping cron scheduler...")
	c.cron.Stop()
}

func (c *CronScheduler) loadBackupConfigs() {
	var configs []models.BackupConfig

	if err := c.db.Find(&configs).Error; err != nil {
		log.Printf("Failed to load backup configs: %v", err)
		return
	}

	for _, cfg := range configs {
		if cfg.IsEnabled {
			c.addJob(cfg)
		}
	}
}

func (c *CronScheduler) addJob(config models.BackupConfig) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if _, exists := c.entries[config.ID]; exists {
		return nil
	}

	entryID, err := c.cron.AddFunc(config.CronExpression, func() {
		c.executeBackup(config)
	})
	if err != nil {
		return err
	}

	c.entries[config.ID] = entryID
	log.Printf("Added cron job for backup config %d: %s", config.ID, config.CronExpression)
	return nil
}

func (c *CronScheduler) executeBackup(config models.BackupConfig) {
	log.Printf("Executing scheduled backup for database %d", config.DatabaseID)

	backup := models.Backup{
		WorkspaceID:   config.WorkspaceID,
		DatabaseID:    config.DatabaseID,
		DatabaseType:  config.DatabaseType,
		BackupType:   config.BackupType,
		Status:       "pending",
		BackupTime:   time.Now(),
	}

	if err := c.db.Create(&backup).Error; err != nil {
		log.Printf("Failed to create backup record: %v", err)
		return
	}

	if c.scheduler != nil {
		payload := TaskPayload{
			Type:         TaskTypeBackup,
			TaskID:       backup.ID,
			WorkspaceID:  backup.WorkspaceID,
			DatabaseID:   backup.DatabaseID,
			DatabaseType: backup.DatabaseType,
			BackupType:   backup.BackupType,
			BackupID:     backup.ID,
		}
		c.scheduler.EnqueueTask(payload)
	}
}

func (c *CronScheduler) RemoveJob(configID uint) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if entryID, exists := c.entries[configID]; exists {
		c.cron.Remove(entryID)
		delete(c.entries, configID)
		log.Printf("Removed cron job for backup config %d", configID)
	}
}

func (c *CronScheduler) UpdateJob(configID uint, cronExpr string, enabled bool) {
	c.RemoveJob(configID)

	if enabled {
		var cfg models.BackupConfig
		if err := c.db.First(&cfg, configID).Error; err == nil {
			c.addJob(cfg)
		}
	}
}

func (c *CronScheduler) watchForChanges() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		c.syncConfigs()
	}
}

func (c *CronScheduler) syncConfigs() {
	var configs []models.BackupConfig

	if err := c.db.Find(&configs).Error; err != nil {
		return
	}

	c.mutex.Lock()
	defer c.mutex.Unlock()

	for _, cfg := range configs {
		if _, exists := c.entries[cfg.ID]; exists {
			continue
		}

		if cfg.IsEnabled {
			c.addJob(cfg)
		}
	}
}