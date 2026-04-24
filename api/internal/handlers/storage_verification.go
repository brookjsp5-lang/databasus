package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/datatrue-new/api/pkg/storage"
	"github.com/gin-gonic/gin"
)

type StorageVerificationHandler struct{}

func NewStorageVerificationHandler() *StorageVerificationHandler {
	return &StorageVerificationHandler{}
}

type TestStorageRequest struct {
	Type        string `json:"type" binding:"required"`
	LocalPath   string `json:"local_path"`
	S3Bucket   string `json:"s3_bucket"`
	S3Region   string `json:"s3_region"`
	S3Endpoint string `json:"s3_endpoint"`
	S3AccessKey string `json:"s3_access_key"`
	S3SecretKey string `json:"s3_secret_key"`
	NASPath    string `json:"nas_path"`
}

type TestStorageResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message"`
	Info    map[string]interface{} `json:"info,omitempty"`
}

func (h *StorageVerificationHandler) TestStorage(c *gin.Context) {
	var req TestStorageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cfg := storage.StorageConfig{
		Type:       storage.StorageType(req.Type),
		LocalPath:  req.LocalPath,
		S3Bucket:   req.S3Bucket,
		S3Region:   req.S3Region,
		S3Endpoint: req.S3Endpoint,
		S3AccessKey: req.S3AccessKey,
		S3SecretKey: req.S3SecretKey,
		NASPath:    req.NASPath,
	}

	store, err := storage.NewStorage(cfg)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无法创建存储实例: " + err.Error(),
		})
		return
	}

	if err := store.Test(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "存储验证失败: " + err.Error(),
		})
		return
	}

	info, _ := store.GetStorageInfo()
	infoJSON, _ := json.Marshal(info)

	var infoMap map[string]interface{}
	json.Unmarshal(infoJSON, &infoMap)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "存储验证成功！",
		"info":    infoMap,
	})
}

func (h *StorageVerificationHandler) GetStorageInfo(c *gin.Context) {
	var req TestStorageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cfg := storage.StorageConfig{
		Type:       storage.StorageType(req.Type),
		LocalPath:  req.LocalPath,
		S3Bucket:   req.S3Bucket,
		S3Region:   req.S3Region,
		S3Endpoint: req.S3Endpoint,
		S3AccessKey: req.S3AccessKey,
		S3SecretKey: req.S3SecretKey,
		NASPath:    req.NASPath,
	}

	store, err := storage.NewStorage(cfg)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法创建存储实例: " + err.Error()})
		return
	}

	info, err := store.GetStorageInfo()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取存储信息: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"info": info})
}
