import { test, expect } from '@playwright/test';

test.describe('PITR恢复页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `restore_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'pitruser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.goto('/restores');
  });

  test('PITR恢复页面加载成功', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'PITR恢复' })).toBeVisible();
  });

  test('显示数据库列表', async ({ page }) => {
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('显示时间线选择器', async ({ page }) => {
    await expect(page.locator('.ant-date-picker')).toBeVisible();
  });
});