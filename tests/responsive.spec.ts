import { test, expect } from '@playwright/test';

test.describe('响应式设计测试', () => {
  const viewports = [
    { name: 'Desktop HD', width: 1920, height: 1080 },
    { name: 'Desktop', width: 1366, height: 768 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Mobile', width: 375, height: 667 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) - 登录页面`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await page.goto('/login');
      await expect(page.locator('h2').filter({ hasText: 'DataBus' })).toBeVisible();
      await expect(page.locator('input[placeholder="admin@example.com"]')).toBeVisible();
    });

    test(`${viewport.name} (${viewport.width}x${viewport.height}) - 仪表盘`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      await page.goto('/login');
      await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
      
      const uniqueEmail = `responsive_${viewport.name}_${Date.now()}@example.com`;
      await page.fill('input[placeholder="设置用户名"]', 'testuser');
      await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
      await page.fill('input[placeholder="设置密码"]', 'password123');
      await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
      
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      await expect(page.locator('h1').filter({ hasText: '仪表盘' })).toBeVisible();
    });
  }
});

test.describe('跨浏览器兼容性测试', () => {
  test('Chrome浏览器 - 登录和注册流程', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h2')).toBeVisible();
    
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    await page.fill('input[placeholder="设置用户名"]', 'chrometest');
    await page.fill('input[placeholder="admin@example.com"]', `chrome_${Date.now()}@example.com`);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('页面加载无控制台错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('manifest') &&
      !e.includes('Warning')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('导航和路由测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `nav_test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'navuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('侧边栏导航到所有页面', async ({ page }) => {
    const pages = [
      { nav: '备份中心', url: '/backup-center' },
      { nav: 'PITR恢复', url: '/restores' },
      { nav: '存储管理', url: '/storages' },
    ];

    for (const p of pages) {
      await page.locator(`text=${p.nav}`).first().click();
      await page.waitForURL(`**${p.url}`, { timeout: 5000 });
      await expect(page).toHaveURL(new RegExp(p.url));
    }
  });

  test('刷新页面保持当前路由', async ({ page }) => {
    await page.goto('/backup-center');
    await page.reload();
    await expect(page).toHaveURL(/backup-center/);
  });
});

test.describe('性能和加载测试', () => {
  test('页面首次加载时间小于3秒', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('登录页面交互响应时间小于500ms', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(500);
  });
});