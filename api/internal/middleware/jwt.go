package middleware

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func JWTAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer {token}"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if userID, ok := claims["user_id"].(float64); ok {
				c.Set("user_id", uint(userID))
			}
			if username, ok := claims["username"].(string); ok {
				c.Set("username", username)
			}
			if email, ok := claims["email"].(string); ok {
				c.Set("email", email)
			}
			if isAdmin, ok := claims["is_admin"].(bool); ok {
				c.Set("is_admin", isAdmin)
			}
		}

		c.Next()
	}
}

func GetUserIDFromContext(c *gin.Context) (uint, bool) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		return 0, false
	}
	switch v := userIDVal.(type) {
	case uint:
		return v, true
	case float64:
		return uint(v), true
	case string:
		if id, err := strconv.ParseUint(v, 10, 32); err == nil {
			return uint(id), true
		}
	}
	return 0, false
}

func GetUsernameFromContext(c *gin.Context) (string, bool) {
	username, exists := c.Get("username")
	if !exists {
		return "", false
	}
	if name, ok := username.(string); ok {
		return name, true
	}
	return "", false
}

func GetEmailFromContext(c *gin.Context) (string, bool) {
	email, exists := c.Get("email")
	if !exists {
		return "", false
	}
	if e, ok := email.(string); ok {
		return e, true
	}
	return "", false
}

func IsAdminFromContext(c *gin.Context) bool {
	isAdmin, exists := c.Get("is_admin")
	if !exists {
		return false
	}
	if admin, ok := isAdmin.(bool); ok {
		return admin
	}
	return false
}
