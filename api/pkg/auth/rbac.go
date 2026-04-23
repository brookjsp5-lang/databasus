package auth

import (
	"github.com/databasus-new/api/internal/models"
)

type Role string

const (
	RoleViewer  Role = "viewer"
	RoleMember  Role = "member"
	RoleAdmin   Role = "admin"
	RoleOwner   Role = "owner"
)

type Permission string

const (
	PermissionViewBackups   Permission = "view_backups"
	PermissionCreateBackup Permission = "create_backup"
	PermissionDeleteBackup Permission = "delete_backup"
	PermissionViewRestores Permission = "view_restores"
	PermissionCreateRestore Permission = "create_restore"
	PermissionViewDatabases Permission = "view_databases"
	PermissionCreateDatabase Permission = "create_database"
	PermissionUpdateDatabase Permission = "update_database"
	PermissionDeleteDatabase Permission = "delete_database"
	PermissionViewSettings  Permission = "view_settings"
	PermissionUpdateSettings Permission = "update_settings"
	PermissionViewUsers     Permission = "view_users"
	PermissionInviteUser    Permission = "invite_user"
	PermissionRemoveUser    Permission = "remove_user"
	PermissionViewAuditLogs Permission = "view_audit_logs"
	PermissionManageRoles   Permission = "manage_roles"
)

type RolePermissions struct {
	Role      Role
	Permissions []Permission
}

var rolePermissionsMap = map[Role][]Permission{
	RoleViewer: {
		PermissionViewBackups,
		PermissionViewRestores,
		PermissionViewDatabases,
		PermissionViewSettings,
		PermissionViewUsers,
		PermissionViewAuditLogs,
	},
	RoleMember: {
		PermissionViewBackups,
		PermissionCreateBackup,
		PermissionDeleteBackup,
		PermissionViewRestores,
		PermissionCreateRestore,
		PermissionViewDatabases,
		PermissionViewSettings,
		PermissionViewUsers,
		PermissionViewAuditLogs,
	},
	RoleAdmin: {
		PermissionViewBackups,
		PermissionCreateBackup,
		PermissionDeleteBackup,
		PermissionViewRestores,
		PermissionCreateRestore,
		PermissionViewDatabases,
		PermissionCreateDatabase,
		PermissionUpdateDatabase,
		PermissionDeleteDatabase,
		PermissionViewSettings,
		PermissionUpdateSettings,
		PermissionViewUsers,
		PermissionInviteUser,
		PermissionRemoveUser,
		PermissionViewAuditLogs,
	},
	RoleOwner: {
		PermissionViewBackups,
		PermissionCreateBackup,
		PermissionDeleteBackup,
		PermissionViewRestores,
		PermissionCreateRestore,
		PermissionViewDatabases,
		PermissionCreateDatabase,
		PermissionUpdateDatabase,
		PermissionDeleteDatabase,
		PermissionViewSettings,
		PermissionUpdateSettings,
		PermissionViewUsers,
		PermissionInviteUser,
		PermissionRemoveUser,
		PermissionViewAuditLogs,
		PermissionManageRoles,
	},
}

func GetPermissionsForRole(role Role) []Permission {
	return rolePermissionsMap[role]
}

func HasPermission(role Role, permission Permission) bool {
	permissions := rolePermissionsMap[role]
	for _, p := range permissions {
		if p == permission {
			return true
		}
	}
	return false
}

func GetRoleLevel(role Role) int {
	switch role {
	case RoleViewer:
		return 1
	case RoleMember:
		return 2
	case RoleAdmin:
		return 3
	case RoleOwner:
		return 4
	default:
		return 0
	}
}

func CanManageRole(requestorRole, targetRole Role) bool {
	return GetRoleLevel(requestorRole) > GetRoleLevel(targetRole)
}

type WorkspaceMember struct {
	ID          uint   `json:"id"`
	UserID     uint   `json:"user_id"`
	WorkspaceID uint   `json:"workspace_id"`
	Role       Role   `json:"role"`
	Username   string `json:"username"`
	Email      string `json:"email"`
}

type WorkspaceMemberModel struct {
	ID          uint   `gorm:"primaryKey"`
	UserID     uint   `gorm:"not null"`
	WorkspaceID uint   `gorm:"not null"`
	Role       string `gorm:"not null;default:'viewer'"`
}

func (WorkspaceMemberModel) TableName() string {
	return "workspace_members"
}

type WorkspaceMemberWithUser struct {
	WorkspaceMemberModel
	User models.User `gorm:"foreignKey:UserID"`
}

type PermissionChecker struct {
	userRole map[uint]Role
}

func NewPermissionChecker() *PermissionChecker {
	return &PermissionChecker{
		userRole: make(map[uint]Role),
	}
}

func (pc *PermissionChecker) SetUserRole(workspaceID, userID uint, role Role) {
	key := workspaceID*10000 + userID
	pc.userRole[key] = role
}

func (pc *PermissionChecker) GetUserRole(workspaceID, userID uint) Role {
	key := workspaceID*10000 + userID
	if role, ok := pc.userRole[key]; ok {
		return role
	}
	return RoleViewer
}

func (pc *PermissionChecker) CheckPermission(workspaceID, userID uint, permission Permission) bool {
	role := pc.GetUserRole(workspaceID, userID)
	return HasPermission(role, permission)
}

type AuthzError struct {
	Message string
}

func (e *AuthzError) Error() string {
	return e.Message
}

func NewForbiddenError(action string) *AuthzError {
	return &AuthzError{
		Message: "您没有权限执行此操作: " + action,
	}
}

func NewUnauthorizedError() *AuthzError {
	return &AuthzError{
		Message: "用户未认证",
	}
}

func CheckPermission(userRole Role, requiredPermission Permission) error {
	if !HasPermission(userRole, requiredPermission) {
		return NewForbiddenError(string(requiredPermission))
	}
	return nil
}

func CheckRoleManagePermission(requestorRole, targetRole Role) error {
	if !CanManageRole(requestorRole, targetRole) {
		return NewForbiddenError("manage role")
	}
	return nil
}