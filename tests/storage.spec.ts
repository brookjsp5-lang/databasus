import { test, expect } from '@playwright/test';

test.describe('存储管理页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `storage_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'storageuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/storages');
  });

  test('存储管理页面加载成功', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: '存储管理' })).toBeVisible();
  });

  test('显示存储列表', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('显示添加存储按钮', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: '添加存储' })).toBeVisible();
  });

  test('点击添加存储按钮打开模态框', async ({ page }) => {
    await page.locator('button').filter({ hasText: '添加存储' }).click();
    await expect(page.locator('.ant-modal')).toBeVisible();
  });

  test('添加存储模态框包含存储类型选择', async ({ page }) => {
    await page.locator('button').filter({ hasText: '添加存储' }).click();
    await expect(page.locator('text=存储类型')).toBeVisible();
    await expect(page.locator('text=本地存储')).toBeVisible();
    await expect(page.locator('text=S3存储')).toBeVisible();
    await expect(page.locator('text=NFS存储')).toBeVisible();
  });
});

test.describe('恢复记录页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `restore_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'restoreuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/restore-records');
  });

  test('恢复记录页面加载成功', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: '恢复记录' })).toBeVisible();
  });

  test('显示恢复记录表格', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('显示统计卡片', async ({ page }) => {
    await expect(page.locator('text=总记录数')).toBeVisible();
  });

  test('显示筛选区域', async ({ page }) => {
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible();
  });
});