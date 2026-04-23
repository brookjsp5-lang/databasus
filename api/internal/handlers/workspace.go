package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/databasus-new/api/internal/models"
	"github.com/databasus-new/api/pkg/auth"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type WorkspaceHandler struct {
	db *gorm.DB
}

func NewWorkspaceHandler(db *gorm.DB) *WorkspaceHandler {
	return &WorkspaceHandler{db: db}
}

type CreateWorkspaceRequest struct {
	Name string `json:"name" binding:"required"`
}

type UpdateWorkspaceRequest struct {
	Name string `json:"name" binding:"required"`
}

type InviteMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

type WorkspaceMemberWithUser struct {
	ID          uint   `json:"id"`
	UserID     uint   `json:"user_id"`
	WorkspaceID uint   `json:"workspace_id"`
	Role       string `json:"role"`
	Username   string `json:"username"`
	Email      string `json:"email"`
}

func (h *WorkspaceHandler) GetAll(c *gin.Context) {
	var workspaces []models.Workspace
	if err := h.db.Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get workspaces"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspaces": workspaces})
}

func (h *WorkspaceHandler) GetByID(c *gin.Context) {
	id := c.Param("id")

	var workspace models.Workspace
	if err := h.db.First(&workspace, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspace": workspace})
}

func (h *WorkspaceHandler) Create(c *gin.Context) {
	var req CreateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")

	workspace := models.Workspace{
		Name: req.Name,
	}

	if err := h.db.Create(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workspace"})
		return
	}

	member := models.WorkspaceMember{
		UserID:     userID.(uint),
		WorkspaceID: workspace.ID,
		Role:       string(auth.RoleOwner),
	}

	if err := h.db.Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create workspace member"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"workspace": workspace})
}

func (h *WorkspaceHandler) Update(c *gin.Context) {
	id := c.Param("id")

	var workspace models.Workspace
	if err := h.db.First(&workspace, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.checkPermission(workspace.ID, userID.(uint), auth.PermissionUpdateSettings); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var req UpdateWorkspaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	workspace.Name = req.Name
	if err := h.db.Save(&workspace).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspace": workspace})
}

func (h *WorkspaceHandler) Delete(c *gin.Context) {
	id := c.Param("id")

	var workspace models.Workspace
	if err := h.db.First(&workspace, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.checkPermission(workspace.ID, userID.(uint), auth.PermissionManageRoles); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only owner can delete workspace"})
		return
	}

	h.db.Delete(&workspace)

	c.JSON(http.StatusOK, gin.H{"message": "Workspace deleted"})
}

func (h *WorkspaceHandler) GetMembers(c *gin.Context) {
	workspaceID := c.Param("id")

	var members []WorkspaceMemberWithUser
	if err := h.db.Table("workspace_members").
		Select("workspace_members.*, users.username, users.email").
		Joins("LEFT JOIN users ON users.id = workspace_members.user_id").
		Where("workspace_members.workspace_id = ?", workspaceID).
		Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get members"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (h *WorkspaceHandler) InviteMember(c *gin.Context) {
	workspaceID := c.Param("id")

	var workspace models.Workspace
	if err := h.db.First(&workspace, workspaceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.checkPermission(workspace.ID, userID.(uint), auth.PermissionInviteUser); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var req InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !auth.HasPermission(auth.Role(req.Role), auth.PermissionInviteUser) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found with this email"})
		return
	}

	var existingMember models.WorkspaceMember
	if err := h.db.Where("user_id = ? AND workspace_id = ?", user.ID, workspaceID).First(&existingMember).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User is already a member"})
		return
	}

	member := models.WorkspaceMember{
		UserID:     user.ID,
		WorkspaceID: workspace.ID,
		Role:       req.Role,
	}

	if err := h.db.Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to invite member"})
		return
	}

	h.logAudit(userID.(uint), "invite_member", "workspace_member", map[string]interface{}{
		"email": req.Email,
		"role":  req.Role,
	})

	c.JSON(http.StatusCreated, gin.H{"member": member})
}

func (h *WorkspaceHandler) UpdateMemberRole(c *gin.Context) {
	workspaceID := c.Param("id")
	memberID := c.Param("memberId")

	var workspace models.Workspace
	if err := h.db.First(&workspace, workspaceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.checkPermission(workspace.ID, userID.(uint), auth.PermissionManageRoles); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var req UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var member models.WorkspaceMember
	if err := h.db.First(&member, memberID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	if member.WorkspaceID != workspace.ID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in workspace"})
		return
	}

	var requestorMember models.WorkspaceMember
	if err := h.db.Where("user_id = ? AND workspace_id = ?", userID, workspace.ID).First(&requestorMember).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Your role in this workspace is unknown"})
		return
	}

	targetRole := auth.Role(req.Role)
	requestorRole := auth.Role(requestorMember.Role)

	if !auth.CanManageRole(requestorRole, targetRole) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot assign role higher than your own"})
		return
	}

	member.Role = req.Role
	if err := h.db.Save(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member role"})
		return
	}

	h.logAudit(userID.(uint), "update_member_role", "workspace_member", map[string]interface{}{
		"member_id": memberID,
		"new_role":  req.Role,
	})

	c.JSON(http.StatusOK, gin.H{"member": member})
}

func (h *WorkspaceHandler) RemoveMember(c *gin.Context) {
	workspaceID := c.Param("id")
	memberID := c.Param("memberId")

	var workspace models.Workspace
	if err := h.db.First(&workspace, workspaceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Workspace not found"})
		return
	}

	userID, _ := c.Get("user_id")
	if err := h.checkPermission(workspace.ID, userID.(uint), auth.PermissionRemoveUser); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var member models.WorkspaceMember
	if err := h.db.First(&member, memberID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	if member.WorkspaceID != workspace.ID {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in workspace"})
		return
	}

	if member.Role == string(auth.RoleOwner) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove workspace owner"})
		return
	}

	h.db.Delete(&member)

	h.logAudit(userID.(uint), "remove_member", "workspace_member", map[string]interface{}{
		"member_id": memberID,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

func (h *WorkspaceHandler) Leave(c *gin.Context) {
	workspaceID := c.Param("id")

	userID, _ := c.Get("user_id")

	var member models.WorkspaceMember
	if err := h.db.Where("user_id = ? AND workspace_id = ?", userID, workspaceID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "You are not a member of this workspace"})
		return
	}

	if member.Role == string(auth.RoleOwner) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Owner cannot leave workspace. Transfer ownership first."})
		return
	}

	h.db.Delete(&member)

	c.JSON(http.StatusOK, gin.H{"message": "You have left the workspace"})
}

func (h *WorkspaceHandler) GetMyRole(c *gin.Context) {
	workspaceID := c.Param("id")

	userID, _ := c.Get("user_id")

	var member models.WorkspaceMember
	if err := h.db.Where("user_id = ? AND workspace_id = ?", userID, workspaceID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "You are not a member of this workspace"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"role":       member.Role,
		"permissions": auth.GetPermissionsForRole(auth.Role(member.Role)),
	})
}

func (h *WorkspaceHandler) checkPermission(workspaceID, userID uint, permission auth.Permission) error {
	var member models.WorkspaceMember
	if err := h.db.Where("user_id = ? AND workspace_id = ?", userID, workspaceID).First(&member).Error; err != nil {
		return auth.NewUnauthorizedError()
	}

	role := auth.Role(member.Role)
	if !auth.HasPermission(role, permission) {
		return auth.NewForbiddenError(string(permission))
	}

	return nil
}

func (h *WorkspaceHandler) logAudit(userID uint, action string, resource string, details map[string]interface{}) {
	detailsJSON, _ := json.Marshal(details)
	auditLog := models.AuditLog{
		UserID:    userID,
		Username:  "",
		Action:    action,
		Resource:  resource,
		Details:   string(detailsJSON),
	}
	h.db.Create(&auditLog)
}