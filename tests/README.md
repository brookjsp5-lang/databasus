# 前端自动化测试指南

本项目使用 Playwright 进行端到端 (E2E) 自动化测试。

## 测试文件结构

```
tests/
├── setup.spec.ts           # 测试环境设置（用户认证）
├── auth.spec.ts            # 登录/注册功能测试
├── dashboard.spec.ts       # 仪表盘页面测试
├── backup-center.spec.ts   # 备份中心功能测试
├── database-wizard.spec.ts # 数据库向导流程测试
├── storage.spec.ts         # 存储管理和恢复记录测试
├── restores.spec.ts         # PITR恢复页面测试
└── responsive.spec.ts       # 响应式和跨浏览器测试
```

## 安装依赖

```bash
cd /opt/datatrue/workspace
npm install
```

## 安装 Playwright 浏览器

```bash
npx playwright install
# 或安装所有浏览器
npx playwright install --with-deps chromium firefox webkit
```

## 运行测试

### 运行所有测试（无头模式）

```bash
npm test
```

### 运行测试并打开 UI

```bash
npm run test:ui
```

### 运行测试并显示浏览器

```bash
npm run test:headed
```

### 运行特定测试文件

```bash
npx playwright test tests/auth.spec.ts
```

### 运行特定测试用例

```bash
npx playwright test tests/auth.spec.ts -g "登录"
```

### 生成测试报告

```bash
npm run test:report
```

## 测试配置

测试配置位于 `playwright.config.ts`：

- **测试目录**: `tests/`
- **支持浏览器**: Chromium, Firefox, Webkit, Mobile Chrome, Mobile Safari
- **报告格式**: HTML, JSON, List
- **截图**: 仅在测试失败时保存
- **视频**: 失败测试保留录制

## 测试范围

### 认证功能
- ✅ 登录页面加载
- ✅ 登录表单验证
- ✅ 注册表单验证
- ✅ 注册成功跳转
- ✅ 未登录访问重定向

### 仪表盘
- ✅ 页面加载
- ✅ 侧边栏导航
- ✅ 导航链接功能
- ✅ 退出登录

### 备份中心
- ✅ Tab切换
- ✅ 添加数据库按钮
- ✅ 添加数据库模态框
- ✅ 表单字段验证
- ✅ 数据库类型选择

### 数据库向导
- ✅ 步骤指示器
- ✅ 所有7个步骤显示
- ✅ 下一步/上一步导航
- ✅ 步骤流程完整性
- ✅ 保存并启动按钮

### 存储管理
- ✅ 页面加载
- ✅ 存储列表显示
- ✅ 添加存储功能
- ✅ 存储类型选择

### 响应式设计
- ✅ 桌面 (1920x1080, 1366x768)
- ✅ 平板 (1024x768, 768x1024)
- ✅ 手机 (375x667)

### 跨浏览器
- ✅ Chrome 浏览器兼容性
- ✅ 无控制台错误检测
- ✅ 页面加载性能 (<3s)

## 故障排除

### Docker 服务未运行

如果测试无法连接，确保 Docker 服务正在运行：

```bash
sudo docker compose up -d
```

### 端口被占用

如果 5173 端口被占用，修改 `vite.config.ts` 中的端口或设置环境变量：

```bash
BASE_URL=http://localhost:5173 npm test
```

### 认证测试失败

某些测试需要新用户。如果后端有用户数量限制，可以减少测试运行频率或清理数据库。

## 生成覆盖率报告

```bash
npm test -- --coverage
```

## 持续集成

在 CI 环境中运行：

```bash
CI=true npm test
```

这将：
- 启用严格模式 (`forbidOnly`)
- 启用重试机制 (2次)
- 使用单线程运行
