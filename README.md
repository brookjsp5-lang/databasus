# DataTrue - 数据库备份工具

<div align="center">

![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)
![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=for-the-badge&logo=go)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12~18-336791?style=for-the-badge&logo=postgresql)
![MySQL](https://img.shields.io/badge/MySQL-5.7~9-4479A1?style=for-the-badge&logo=mysql)

**基于Go + React的数据库备份管理系统，支持PostgreSQL和MySQL物理备份与PITR恢复**

</div>

---

## 📖 项目简介

本项目是DataTrue数据库备份工具的Go+React实现版本，专注于提供轻量、高效的数据库备份与恢复解决方案。项目采用前后端分离架构，后端使用Go语言（Gin框架)，前端使用React + TypeScript + Vite构建。

### 技术栈

| 层级 | 技术选型 |
|------|----------|
| **后端** | Go 1.24+ / Gin Web框架 |
| **前端** | React 18 / TypeScript / Vite |
| **数据库** | PostgreSQL 16 |
| **缓存** | Redis 7 |
| **部署** | Docker / Docker Compose |

---

## ✨ 核心功能

### 💾 备份功能

- **PostgreSQL物理备份**
  - 基于`pg_basebackup`工具实现
  - 支持tar格式压缩备份
  - 自动收集备份元数据（backup_label）

- **MySQL物理备份**
  - 基于Percona XtraBackup实现
  - 支持全量备份和增量备份
  - 自动解析备份信息（xtrabackup_info）

- **PITR时间点恢复**
  - PostgreSQL：支持WAL归档应用
  - MySQL：支持binlog点时间恢复
  - 精确到秒级恢复

### 📦 备份管理

- **备份配置管理**
  - 支持cron表达式调度
  - 灵活保留策略（按时间/按数量）
  - 压缩级别配置（1-9级）

- **存储管理**
  - 本地存储支持
  - S3兼容存储（可扩展）

- **加密功能**
  - AES-256-GCM文件加密
  - 加密密钥管理

### 🔔 监控告警

- **健康检查**
  - 数据库连接状态监控
  - 备份任务状态检查
  - 存储空间监控

- **告警通知**
  - 多渠道支持（Email、Webhook等）
  - 告警历史管理
  - 未读告警计数

### 👥 多工作空间

- **用户权限管理**
  - JWT认证
  - RBAC基于角色的访问控制

- **工作空间隔离**
  - 数据库分组管理
  - 配置独立管理

---

## 🛠️ 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Backend API   │     │   Database      │
│   (React)       │────▶│   (Go/Gin)     │────▶│   (PostgreSQL)  │
│   Port: 80      │     │   Port: 6001   │     │   Port: 5432    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Redis Cache   │
                        │   Port: 6379    │
                        └─────────────────┘
```

### 目录结构

```
workspace/
├── api/                          # Go后端
│   ├── cmd/api/main.go           # 程序入口
│   ├── internal/
│   │   ├── config/               # 配置管理
│   │   ├── handlers/             # HTTP处理器
│   │   ├── middleware/           # 中间件
│   │   └── models/              # 数据模型
│   └── pkg/
│       ├── backup/               # 备份模块
│       │   ├── postgresql_physical.go
│       │   ├── mysql_physical.go
│       │   └── wal_backup.go
│       ├── restore/              # 恢复模块
│       │   ├── postgresql_pitr.go
│       │   └── mysql_pitr.go
│       ├── scheduler/            # 调度器
│       ├── encryption/           # 加密模块
│       ├── compression/          # 压缩模块
│       ├── agent/                # Agent模式
│       ├── monitor/              # 监控模块
│       └── websocket/            # WebSocket
├── src/                          # React前端
│   ├── components/               # 组件
│   ├── pages/                  # 页面
│   ├── hooks/                   # 自定义Hooks
│   └── services/                # API服务
├── docker-compose.yml          # Docker编排
└── nginx.conf                  # Nginx配置
```

---

## 🚀 安装指南

### 环境要求

| 组件 | 最低版本 |
|------|----------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |
| PostgreSQL | 16 |
| Redis | 7 |

### 快速启动

1. **克隆代码**
```bash
git clone https://github.com/brookjsp5-lang/datatrue.git
cd datatrue
```

2. **启动服务**
```bash
docker compose up -d
```

3. **访问应用**
- 前端地址：http://localhost:80
- 后端API：http://localhost:6001

4. **默认登录**
- 邮箱：`admin@datatrue.io`
- 密码：`admin123`

### 开发环境

**后端开发**
```bash
cd api
go mod tidy
go run cmd/api/main.go
```

**前端开发**
```bash
pnpm install
pnpm dev
```

---

## 📖 使用文档

### 添加数据库

1. 进入「数据库」页面
2. 点击「添加数据库」
3. 选择数据库类型（PostgreSQL/MySQL）
4. 填写连接信息：
   - 主机地址
   - 端口号
   - 用户名密码
   - 数据库名称
5. 点击「保存」

### 创建备份配置

1. 进入「备份配置」页面
2. 点击「新建备份配置」
3. 选择目标数据库
4. 配置备份选项：
   - **备份类型**：物理备份/逻辑备份
   - **压缩启用**：是/否
   - **压缩级别**：1-9
   - **加密启用**：是/否
5. 配置调度计划：
   - **调度类型**：每日/每周/Cron
   - **执行时间**：自定义时间
6. 配置保留策略：
   - **保留类型**：按时间/按数量
   - **保留天数/数量**
7. 点击「创建」

### 执行备份

**手动备份**
1. 进入「备份」页面
2. 点击「立即备份」
3. 选择数据库和备份选项
4. 监控备份进度

**定时备份**
- 系统根据配置的调度自动执行

### 数据恢复

**全量恢复**
1. 进入「备份」页面
2. 选择要恢复的备份点
3. 点击「恢复」按钮
4. 确认恢复信息
5. 等待恢复完成

**PITR时间点恢复**
1. 进入「恢复」页面
2. 选择PITR恢复模式
3. 选择目标数据库
4. 指定精确恢复时间点
5. 系统自动处理恢复流程

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | API服务端口 | 6001 |
| `DB_HOST` | PostgreSQL主机 | postgres |
| `DB_PORT` | PostgreSQL端口 | 5432 |
| `DB_USER` | 数据库用户 | postgres |
| `DB_PASSWORD` | 数据库密码 | postgres123 |
| `DB_NAME` | 数据库名称 | datatrue |
| `DB_SSLMODE` | SSL模式 | disable |
| `REDIS_ADDR` | Redis地址 | redis:6379 |
| `JWT_SECRET` | JWT密钥 | - |
| `JWT_EXPIRES_IN` | Token过期时间(小时) | 24 |

### 备份配置参数

| 参数 | 说明 | 可选值 |
|------|------|--------|
| `Compress` | 启用压缩 | true/false |
| `CompressLevel` | 压缩级别 | 1-9 |
| `EncryptionEnabled` | 启用加密 | true/false |
| `RetentionType` | 保留策略类型 | time/count |
| `RetentionDays` | 保留天数 | 正整数 |
| `RetentionCount` | 保留数量 | 正整数 |

---

## 🔧 故障排查

### 常见问题

**Q1: 备份失败如何排查？**

1. 检查数据库连接信息是否正确
2. 确认备份用户权限是否足够
3. 查看API日志：
   ```bash
   docker logs datatrue-api
   ```

**Q2: PostgreSQL备份需要什么权限？**

备份用户需要以下权限：
```sql
GRANT pg_read_all_settings TO backup_user;
GRANT pg_monitor TO backup_user;
GRANT CONNECT ON DATABASE your_database TO backup_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
```

**Q3: MySQL备份需要什么权限？**

```sql
GRANT SELECT, RELOAD, LOCK TABLES, REPLICATION CLIENT ON *.* TO 'backup_user'@'%';
GRANT PROCESS ON *.* TO 'backup_user'@'%';
```

**Q4: 如何查看备份进度？**

系统支持WebSocket实时进度推送，可在「备份」页面实时查看备份进度。

---

## 📝 数据库模型

### 核心表结构

- **users** - 用户表
- **workspaces** - 工作空间表
- **mysql_databases** - MySQL数据库配置
- **postgresql_databases** - PostgreSQL数据库配置
- **backups** - 备份记录表
- **backup_configs** - 备份配置表
- **restores** - 恢复记录表
- **storages** - 存储配置表
- **alerts** - 告警记录表
- **tasks** - 任务调度表

---

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发流程

1. Fork本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交代码：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建Pull Request

### 代码规范

- Go代码遵循官方格式化规范（gofmt）
- React组件使用TypeScript
- 提交信息使用语义化前缀（feat/fix/docs/refactor）

---

## 📄 许可证

本项目基于 Apache 2.0 许可证开源。

---

## 🙏 致谢

- [Gin](https://github.com/gin-gonic/gin) - Web框架
- [GORM](https://gorm.io/) - ORM库
- [React](https://react.dev/) - UI框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Percona XtraBackup](https://www.percona.com/software/mysql-database/percona-xtrabackup) - MySQL备份工具

---

<div align="center">

**DataTrue** - 让数据库备份变得简单

</div>
