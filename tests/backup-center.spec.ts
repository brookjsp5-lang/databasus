import { test, expect } from '@playwright/test';

test.describe('备份中心页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `backup_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'backupuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/backup-center');
  });

  test('备份中心页面加载成功', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: '备份中心' })).toBeVisible();
  });

  test('显示数据库管理和备份记录Tab', async ({ page }) => {
    await expect(page.locator('.ant-tabs-tab').filter({ hasText: '数据库管理' })).toBeVisible();
    await expect(page.locator('.ant-tabs-tab').filter({ hasText: '备份记录' })).toBeVisible();
  });

  test('默认显示数据库管理Tab', async ({ page }) => {
    const databaseTab = page.locator('.ant-tabs-tab').filter({ hasText: '数据库管理' });
    await expect(databaseTab).toHaveClass(/ant-tabs-tab-active/);
  });

  test('可以切换到备份记录Tab', async ({ page }) => {
    await page.locator('.ant-tabs-tab').filter({ hasText: '备份记录' }).click();
    const backupTab = page.locator('.ant-tabs-tab').filter({ hasText: '备份记录' });
    await expect(backupTab).toHaveClass(/ant-tabs-tab-active/);
  });

  test('数据库管理Tab显示添加数据库按钮', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: '添加数据库' })).toBeVisible();
  });

  test('点击添加数据库按钮打开模态框', async ({ page }) => {
    await page.locator('button').filter({ hasText: '添加数据库' }).click();
    await expect(page.locator('.ant-modal')).toBeVisible();
    await expect(page.locator('text=添加数据库').or(page.locator('text=编辑数据库')).first()).toBeVisible();
  });

  test('添加数据库模态框包含表单字段', async ({ page }) => {
    await page.locator('button').filter({ hasText: '添加数据库' }).click();
    
    await expect(page.locator('text=数据库名称')).toBeVisible();
    await expect(page.locator('text=数据库类型')).toBeVisible();
    await expect(page.locator('text=主机地址')).toBeVisible();
    await expect(page.locator('text=端口')).toBeVisible();
    await expect(page.locator('text=用户名')).toBeVisible();
    await expect(page.locator('text=密码')).toBeVisible();
  });

  test('选择数据库类型显示对应端口', async ({ page }) => {
    await page.locator('button').filter({ hasText: '添加数据库' }).click();
    
    await page.locator('.ant-select').filter({ hasText: '请选择数据库类型' }).click();
    await page.locator('.ant-select-dropdown').locator('.ant-select-item').filter({ hasText: 'MySQL' }).click();
    
    const portInput = page.locator('input[placeholder="3306"]');
    await expect(portInput).toBeVisible();
  });

  test('备份记录Tab显示创建备份按钮', async ({ page }) => {
    await page.locator('.ant-tabs-tab').filter({ hasText: '备份记录' }).click();
    await expect(page.locator('button').filter({ hasText: '创建备份' })).toBeVisible();
  });
});

test.describe('备份中心表单验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `backup_form_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'backupformuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/backup-center');
    await page.locator('button').filter({ hasText: '添加数据库' }).click();
  });

  test('不填写表单点击创建显示验证错误', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^创建$/ }).click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
  });
});