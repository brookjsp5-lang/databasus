import { test, expect } from '@playwright/test';

test.describe('仪表盘页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `dashboard_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'dashboarduser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('仪表盘页面加载成功', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: '仪表盘' })).toBeVisible();
  });

  test('侧边栏导航存在', async ({ page }) => {
    await expect(page.locator('text=仪表盘').first()).toBeVisible();
    await expect(page.locator('text=备份中心').first()).toBeVisible();
    await expect(page.locator('text=存储管理').first()).toBeVisible();
  });

  test('导航到备份中心', async ({ page }) => {
    await page.locator('text=备份中心').first().click();
    await expect(page).toHaveURL(/backup-center/);
    await expect(page.locator('h1').filter({ hasText: '备份中心' })).toBeVisible();
  });

  test('导航到存储管理', async ({ page }) => {
    await page.locator('text=存储管理').first().click();
    await page.locator('text=存储列表').click();
    await expect(page).toHaveURL(/storages/);
  });

  test('导航到恢复记录', async ({ page }) => {
    await page.locator('text=存储管理').first().click();
    await page.locator('text=恢复记录').click();
    await expect(page).toHaveURL(/restore-records/);
  });

  test('用户信息显示在侧边栏', async ({ page }) => {
    await expect(page.locator('text=dashboarduser').first()).toBeVisible();
  });

  test('退出登录功能', async ({ page }) => {
    const logoutButton = page.locator('text=退出').or(page.locator('text=Logout')).or(page.locator('[aria-label="logout"]')).first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe('仪表盘统计卡片', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `stats_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'statsuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('页面包含统计卡片区域', async ({ page }) => {
    await page.waitForSelector('.ant-card, [class*="card"]', { timeout: 5000 });
    const cards = page.locator('.ant-card, [class*="card"]');
    await expect(cards.first()).toBeVisible();
  });
});