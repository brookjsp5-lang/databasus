import { test, expect } from '@playwright/test';

test.describe('数据库向导页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `wizard_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'wizarduser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/database-wizard');
  });

  test('数据库向导页面加载成功', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: '新建数据库向导' })).toBeVisible();
  });

  test('显示步骤指示器', async ({ page }) => {
    await expect(page.locator('.ant-steps')).toBeVisible();
  });

  test('显示所有步骤标题', async ({ page }) => {
    await expect(page.locator('text=数据库类型')).toBeVisible();
    await expect(page.locator('text=连接设置')).toBeVisible();
    await expect(page.locator('text=备份类型')).toBeVisible();
    await expect(page.locator('text=排程配置')).toBeVisible();
    await expect(page.locator('text=存储位置')).toBeVisible();
    await expect(page.locator('text=保留策略')).toBeVisible();
    await expect(page.locator('text=通知设置')).toBeVisible();
  });

  test('第一步显示数据库类型选择', async ({ page }) => {
    await expect(page.locator('text=选择数据库类型')).toBeVisible();
    await expect(page.locator('text=MySQL')).toBeVisible();
    await expect(page.locator('text=PostgreSQL')).toBeVisible();
  });

  test('选择MySQL数据库类型', async ({ page }) => {
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ })).toHaveClass(/ant-radio-button-wrapper-checked/);
  });

  test('选择PostgreSQL数据库类型', async ({ page }) => {
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: /PostgreSQL/ }).click();
    await expect(page.locator('.ant-radio-button-wrapper').filter({ hasText: /PostgreSQL/ })).toHaveClass(/ant-radio-button-wrapper-checked/);
  });

  test('下一步按钮初始状态', async ({ page }) => {
    const nextButton = page.locator('button').filter({ hasText: '下一步' });
    await expect(nextButton).toBeVisible();
  });

  test('选择数据库类型后可点击下一步', async ({ page }) => {
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
    const nextButton = page.locator('button').filter({ hasText: '下一步' });
    await expect(nextButton).toBeEnabled();
  });

  test('点击下一步进入连接设置步骤', async ({ page }) => {
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
    await page.locator('button').filter({ hasText: '下一步' }).click();
    await expect(page.locator('text=数据库连接设置')).toBeVisible();
  });

  test('连接设置步骤显示所有表单字段', async ({ page }) => {
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
    await page.locator('button').filter({ hasText: '下一步' }).click();
    
    await expect(page.locator('text=数据库名称')).toBeVisible();
    await expect(page.locator('text=主机地址')).toBeVisible();
    await expect(page.locator('text=端口')).toBeVisible();
    await expect(page.locator('text=用户名')).toBeVisible();
    await expect(page.locator('text=密码')).toBeVisible();
    await expect(page.locator('text=数据库名')).toBeVisible();
    await expect(page.locator('text=数据库版本')).toBeVisible();
  });

  test('可以返回上一步', async ({ page }) => {
    await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
    await page.locator('button').filter({ hasText: '下一步' }).click();
    await expect(page.locator('text=数据库连接设置')).toBeVisible();
    
    await page.locator('button').filter({ hasText: '上一步' }).click();
    await expect(page.locator('text=选择数据库类型')).toBeVisible();
  });

  test('取消按钮存在', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: '取消' })).toBeVisible();
  });
});

test.describe('数据库向导步骤流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `wizard_flow_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'wizardflowuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/database-wizard');
  });

  test('完成所有步骤到最后一步', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
      await page.locator('button').filter({ hasText: '下一步' }).click();
      await page.waitForTimeout(100);
    }
    
    await expect(page.locator('text=通知设置')).toBeVisible();
  });

  test('最后一步显示保存并启动按钮', async ({ page }) => {
    for (let i = 0; i < 6; i++) {
      await page.locator('.ant-radio-button-wrapper').filter({ hasText: /MySQL/ }).click();
      await page.locator('button').filter({ hasText: '下一步' }).click();
      await page.waitForTimeout(100);
    }
    
    await expect(page.locator('button').filter({ hasText: '保存并启动' })).toBeVisible();
  });
});