package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/databasus-new/api/internal/config"
	"github.com/databasus-new/api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// 内存存储用户信息
type memoryStorage struct {
	users map[string]*models.User
	mutex sync.RWMutex
	nextID uint
}

var (
	memStorage = &memoryStorage{
		users:  make(map[string]*models.User),
		nextID: 1,
	}
)

// AuthHandler 认证处理器
type AuthHandler struct {
	db     *gorm.DB
	jwtCfg config.JWTConfig
}

// NewAuthHandler 创建认证处理器
func NewAuthHandler(db *gorm.DB, jwtCfg config.JWTConfig) *AuthHandler {
	return &AuthHandler{db: db, jwtCfg: jwtCfg}
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register 注册用户
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 哈希密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// 创建用户
	user := models.User{
		ID:       uint(memStorage.nextID),
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
		IsAdmin:  false,
	}

	// 检查用户是否已存在
	memStorage.mutex.Lock()
	defer memStorage.mutex.Unlock()
	if _, exists := memStorage.users[req.Email]; exists {
		c.JSON(http.StatusConflict, gin.H{"error": "User with this email already exists"})
		return
	}

	// 存储用户
	memStorage.users[req.Email] = &user
	memStorage.nextID++

	// 生成JWT令牌
	token, err := h.generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"token":   token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"is_admin": user.IsAdmin,
		},
	})
}

// Login 用户登录
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 查找用户
	memStorage.mutex.RLock()
	user, exists := memStorage.users[req.Email]
	memStorage.mutex.RUnlock()

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// 生成JWT令牌
	token, err := h.generateToken(*user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"is_admin": user.IsAdmin,
		},
	})
}

// RefreshToken 刷新令牌
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// 从上下文中获取用户信息
	email, exists := c.Get("email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// 查找用户
	memStorage.mutex.RLock()
	user, exists := memStorage.users[email.(string)]
	memStorage.mutex.RUnlock()

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	// 生成新令牌
	token, err := h.generateToken(*user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Token refreshed",
		"token":   token,
	})
}

// generateToken 生成JWT令牌
func (h *AuthHandler) generateToken(user models.User) (string, error) {
	// 创建声明
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"email":    user.Email,
		"is_admin": user.IsAdmin,
		"exp":      time.Now().Add(time.Hour * time.Duration(h.jwtCfg.ExpiresIn)).Unix(),
	}

	// 创建令牌
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// 签名令牌
	tokenString, err := token.SignedString([]byte(h.jwtCfg.Secret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}