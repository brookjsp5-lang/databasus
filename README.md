# DatabasUS - 数据库备份工具

<div align="center">

![DatabasUS Logo](https://img.shields.io/badge/DatabasUS-数据库备份工具-blue?style=for-the-badge)
![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?style=for-the-badge&logo=go)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12~18-336791?style=for-the-badge&logo=postgresql)
![MySQL](https://img.shields.io/badge/MySQL-5.7~9-4479A1?style=for-the-badge&logo=mysql)
![License](https://img.shields.io/badge/License-Apache%202.0-green?style=for-the-badge)

**企业级数据库备份解决方案，支持PostgreSQL、MySQL/MariaDB和MongoDB**

[功能特点](#功能特点) • [安装指南](#安装指南) • [使用文档](#使用文档) • [配置说明](#配置说明) • [FAQ](#常见问题) • [贡献指南](#贡献指南)

</div>

---

## 📖 项目概述

DatabasUS 是一款开源、自托管的数据库备份工具，专注于为企业和开发团队提供安全、可靠的数据库备份与恢复解决方案。项目以**零信任安全**为设计理念，支持本地部署和云端存储，确保数据始终处于您的完全控制之下。

### 核心价值

- **数据主权**：所有备份数据存储在您的基础设施中，完全自主可控
- **企业级安全**：采用AES-256-GCM加密，确保备份文件即使泄露也无法被恶意利用
- **灵活的部署方式**：支持传统直连模式和轻量级Agent模式，适应各种网络架构
- **精确恢复能力**：支持时间点恢复（PITR），实现近乎零数据丢失的灾难恢复
- **多数据库支持**：全面支持PostgreSQL、MySQL/MariaDB和MongoDB主流版本

---

## ✨ 功能特点

### 💾 支持的数据库

| 数据库 | 支持版本 | 备份类型 |
|--------|----------|----------|
| **PostgreSQL** | 12, 13, 14, 15, 16, 17, 18 | 物理备份、逻辑备份、WAL归档 |
| **MySQL** | 5.7, 8.0, 8.4, 9.0 | 物理备份（XtraBackup）、逻辑备份 |
| **MariaDB** | 10, 11, 12 | 物理备份、逻辑备份 |
| **MongoDB** | 4, 5, 6, 7, 8 | 物理备份、逻辑备份 |

### 🔄 备份计划

- **灵活的调度策略**：支持每小时、每天、每周、每月或自定义Cron表达式
- **精确时间控制**：可在低峰时段（如凌晨4点）执行备份任务
- **智能压缩**：平衡压缩比（4-8倍空间节省）与性能开销（约20%）

### 🗑️ 保留策略

- **时间期限**：按固定周期保留（如7天、3个月、1年）
- **数量限制**：仅保留最近N个备份（如最近30个）
- **GFS策略**：祖父-父亲-儿子分层保留策略，支持按小时、天、周、月、年独立设置
- **容量控制**：支持设置单个备份和总存储空间上限

### 🗄️ 存储目的地

| 存储类型 | 说明 |
|----------|------|
| **本地存储** | VPS/服务器本地磁盘 |
| **云存储** | S3、Cloudflare R2、Google Drive、Azure Blob |
| **网络存储** | NAS、Dropbox、SFTP、Rclone |
| **企业存储** | 支持任何S3兼容存储 |

### 📱 通知系统

- **多渠道支持**：Email、Telegram、Slack、Discord、Webhook
- **实时更新**：备份成功和失败即时通知
- **团队协作**：完美适配DevOps工作流

### 🔒 企业级安全

- **AES-256-GCM加密**：企业级备份文件保护
- **零信任存储**：备份数据加密后存储，即使被非法访问也无法使用
- **敏感信息加密**：所有敏感数据加密存储，日志和错误信息中不暴露
- **最小权限原则**：默认使用只读用户备份，绝不存储任何可修改数据的内容

### 🔌 连接模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **远程模式** | DatabasUS直接通过网络连接数据库（推荐） | 云托管数据库、自托管数据库 |
| **Agent模式** | 轻量级Agent运行在数据库旁，流式传输备份 | 需暴露数据库端口、内部网络 |

### 📦 备份类型

- **逻辑备份**：数据库特定格式的原生导出，边压缩边流式传输到存储，无中间文件
- **物理备份**：整个数据库集群的文件级副本，适合大型数据集，备份恢复速度更快
- **增量备份**：物理基准备份+WAL段持续归档，支持PITR时间点恢复

### 🎨 用户体验

- **设计师级UI**：精致直观的界面设计
- **深色/浅色主题**：适应不同工作环境
- **移动端适配**：随时随地检查备份状态

---

## 🚀 安装指南

### 环境要求

| 组件 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 2核 | 4核+ |
| 内存 | 4GB | 8GB+ |
| 磁盘 | 50GB | 100GB+ SSD |
| Docker | 20.10+ | 最新稳定版 |
| Docker Compose | 2.0+ | 最新稳定版 |

### 方式一：自动化安装脚本（推荐）

仅支持Linux系统，一键安装Docker和DatabasUS：

```bash
sudo apt-get install -y curl && \
sudo curl -sSL https://raw.githubusercontent.com/brookjsp5-lang/databasus/main/install-databasus.sh | sudo bash
```

安装脚本将自动完成以下操作：
- ✅ 安装Docker（若未安装）
- ✅ 安装Docker Compose（若未安装）
- ✅ 配置DatabasUS
- ✅ 配置系统开机自启动

### 方式二：Docker快速启动

```bash
docker run -d \
  --name databasus \
  -p 4005:4005 \
  -v ./databasus-data:/databasus-data \
  --restart unless-stopped \
  databasus/databasus:latest
```

### 方式三：Docker Compose部署

1. 创建项目目录：
```bash
mkdir -p databasus && cd databasus
```

2. 下载docker-compose.yml：
```bash
curl -O https://raw.githubusercontent.com/brookjsp5-lang/databasus/main/docker-compose.yml
```

3. 启动服务：
```bash
docker compose up -d
```

4. 访问Web界面：http://your-server:4005

### 方式四：Kubernetes Helm部署

```bash
helm repo add databasus https://charts.databasus.io
helm install databasus databasus/databasus
```

---

## 📖 使用文档

### 首次配置

1. **访问Web界面**
   
   打开浏览器访问 `http://your-server:4005`，首次登录使用默认管理员账号：
   - 用户名：`admin@databasus.io`
   - 密码：`admin123`（请立即修改）

2. **创建工作空间**
   
   工作空间用于分组管理数据库、存储和通知设置。建议按项目或团队创建独立的工作空间。

3. **添加数据库连接**
   
   点击「数据库」→「添加数据库」，填写连接信息：
   ```yaml
   名称: my-postgres
   类型: PostgreSQL
   主机: 192.168.1.100
   端口: 5432
   用户: backup_user
   密码: ********
   数据库名: myapp_production
   ```

4. **配置备份存储**
   
   支持多种存储后端：
   - **本地存储**：适用于单机部署
   - **S3兼容存储**：AWS S3、MinIO、R2等
   - **网络存储**：SFTP、NFS等

### 创建备份任务

1. 进入「备份配置」→「新建备份配置」
2. 选择目标数据库和备份类型
3. 设置备份计划（推荐：每日凌晨2点）
4. 配置保留策略（推荐：保留7天）
5. 启用加密（生产环境强烈建议）
6. 点击「创建」

### 执行即时备份

除了计划备份，您还可以手动执行即时备份：

1. 进入「备份」页面
2. 点击「立即备份」按钮
3. 选择备份选项（加密、压缩等）
4. 监控备份进度

### 数据恢复

#### 全量恢复

1. 进入「备份」页面
2. 选择要恢复的备份点
3. 点击「恢复」按钮
4. 确认恢复目标（新建数据库或覆盖现有）
5. 等待恢复完成

#### 时间点恢复（PITR）

1. 进入「恢复」页面
2. 选择PITR恢复模式
3. 指定目标恢复时间点
4. 系统自动应用WAL归档
5. 完成恢复到指定时间点

---

## ⚙️ 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `PORT` | API服务端口 | 4005 | 否 |
| `DB_HOST` | PostgreSQL主机 | postgres | 是 |
| `DB_PORT` | PostgreSQL端口 | 5432 | 否 |
| `DB_USER` | PostgreSQL用户 | postgres | 是 |
| `DB_PASSWORD` | PostgreSQL密码 | - | 是 |
| `DB_NAME` | 数据库名称 | databasus | 是 |
| `DB_SSLMODE` | SSL模式 | disable | 否 |
| `REDIS_ADDR` | Redis地址 | redis:6379 | 否 |
| `JWT_SECRET` | JWT密钥 | - | 是 |
| `JWT_EXPIRES_IN` | JWT过期时间（小时） | 24 | 否 |

### 备份加密配置

启用AES-256-GCM加密：

```yaml
# 在备份配置中启用
encryption_enabled: true
encryption_key: "your-32-byte-encryption-key"
```

**安全建议**：
- 使用随机生成的32字节密钥
- 密钥应安全存储，建议使用密钥管理服务
- 定期轮换加密密钥

### 压缩级别配置

| 级别 | 名称 | 压缩比 | CPU开销 | 适用场景 |
|------|------|--------|---------|----------|
| 1 | 极速 | 低 | 最低 | 实时备份、高频任务 |
| 6 | 均衡 | 中 | 中等 | 日常备份 |
| 9 | 最大 | 高 | 最高 | 长期归档、带宽受限 |

### Agent模式配置

```yaml
# Agent配置文件
agent:
  id: "agent-01"
  server_url: "https://your-databasus-server.com"
  auth_token: "your-agent-auth-token"
  heartbeat_interval: 30s
  backup_directory: "/var/lib/databasus/backup"
```

---

## ❓ 常见问题

### Q1: 如何选择备份类型？

**逻辑备份 vs 物理备份**：

| 场景 | 推荐类型 | 原因 |
|------|----------|------|
| 小型数据库（<10GB） | 逻辑备份 | 灵活、恢复简单 |
| 大型数据库（>100GB） | 物理备份 | 速度快、占用空间少 |
| 需要PITR | 物理备份+WAL | 支持精确时间点恢复 |
| 跨版本迁移 | 逻辑备份 | 兼容性更好 |

### Q2: 备份失败如何排查？

1. **检查日志**：
   ```bash
   docker logs databasus-api
   ```

2. **常见原因**：
   - 数据库连接信息错误
   - 备份用户权限不足
   - 磁盘空间不足
   - 网络连接问题

3. **权限要求**：
   - PostgreSQL：备份用户需要`pg_read_all_settings`和`pg_monitor`角色
   - MySQL：备份用户需要`SELECT`、`RELOAD`、`LOCK TABLES`、`REPLICATION CLIENT`权限

### Q3: 如何实现异地容灾？

1. 配置远程S3/R2存储作为备份目的地
2. 启用端到端加密
3. 设置跨区域复制（如果存储支持）
4. 定期测试恢复流程

### Q4: 支持哪些恢复场景？

- ✅ 全量恢复：恢复到某个完整备份点
- ✅ 时间点恢复（PITR）：恢复到指定时间点
- ✅ 单表恢复：从逻辑备份中提取特定表
- ✅ 异机恢复：在不同服务器上恢复备份
- ✅ 跨数据库类型恢复：MySQL到MySQL、PostgreSQL到PostgreSQL

### Q5: 如何监控备份健康状态？

DatabasUS提供内置健康检查和告警功能：

1. **健康检查端点**：`GET /api/health`
2. **配置告警规则**：在「设置」→「告警」中配置
3. **第三方集成**：支持Prometheus、grafana等

### Q6: 许可证是什么？

DatabasUS采用 **Apache License 2.0** 开源许可证，允许商业使用、修改、分发和个人使用。

---

## 🤝 贡献指南

我们欢迎任何形式的贡献，包括但不限于代码提交、文档改进、Bug报告和功能建议。

### 贡献流程

1. **Fork仓库**：点击GitHub页面右上角的Fork按钮
2. **克隆代码**：
   ```bash
   git clone https://github.com/your-username/databasus.git
   cd databasus
   ```
3. **创建分支**：
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **编写代码**：遵循项目的代码规范
5. **提交更改**：
   ```bash
   git commit -m "feat: 添加新功能描述"
   ```
6. **推送分支**：
   ```bash
   git push origin feature/your-feature-name
   ```
7. **创建Pull Request**：在GitHub上创建PR并描述更改内容

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/brookjsp5-lang/databasus.git
cd databasus

# 启动开发环境
docker compose -f docker-compose.dev.yml up -d

# 运行测试
go test ./...

# 代码格式化
go fmt ./...
```

### 代码规范

- 遵循Go官方代码规范
- 所有新功能必须包含测试用例
- 提交信息使用语义化版本（feat、fix、docs等）
- 更新相应的中文文档

### 问题反馈

如果您发现Bug或有功能建议，请通过以下方式反馈：

- **GitHub Issues**：https://github.com/brookjsp5-lang/databasus/issues
- **功能请求**：在Issues中选择`enhancement`标签

---

## 📄 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。

---

## 🙏 致谢

特别感谢以下开源项目和贡献者：

- [Go](https://golang.org/) - Go语言
- [Gin](https://github.com/gin-gonic/gin) - Web框架
- [PostgreSQL](https://www.postgresql.org/) - 数据库
- [MySQL](https://www.mysql.com/) - 数据库
- [XtraBackup](https://www.percona.com/software/mysql-database/percona-xtrabackup) - MySQL备份工具
- [pg_basebackup](https://www.postgresql.org/docs/current/app-pgbasebackup.html) - PostgreSQL备份工具

---

<div align="center">

**DatabasUS** - 让数据库备份变得简单、安全、可靠

© 2024-2026 DatabasUS Team. All rights reserved.

</div>
