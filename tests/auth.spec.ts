import { test, expect } from '@playwright/test';

test.describe('登录页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('页面加载成功', async ({ page }) => {
    await expect(page).toHaveTitle(/DataBus/);
    await expect(page.locator('text=DataBus')).toBeVisible();
  });

  test('登录表单存在且可填写', async ({ page }) => {
    await expect(page.locator('input[placeholder="admin@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="输入密码"]')).toBeVisible();
  });

  test('登录Tab默认激活', async ({ page }) => {
    const loginTab = page.locator('.ant-tabs-tab').filter({ hasText: '登录' });
    await expect(loginTab).toHaveClass(/ant-tabs-tab-active/);
  });

  test('可以切换到注册Tab', async ({ page }) => {
    const registerTab = page.locator('.ant-tabs-tab').filter({ hasText: '注册' });
    await registerTab.click();
    await expect(registerTab).toHaveClass(/ant-tabs-tab-active/);
  });

  test('未填写表单点击登录显示验证错误', async ({ page }) => {
    const loginButton = page.locator('button[type="submit"]').filter({ hasText: '登录' });
    await loginButton.click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
  });

  test('注册Tab显示用户名、邮箱、密码字段', async ({ page }) => {
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    await expect(page.locator('input[placeholder="设置用户名"]')).toBeVisible();
    await expect(page.locator('input[placeholder="admin@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="设置密码"]')).toBeVisible();
  });
});

test.describe('注册功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
  });

  test('可以填写注册表单', async ({ page }) => {
    await page.fill('input[placeholder="设置用户名"]', 'testuser');
    await page.fill('input[placeholder="admin@example.com"]', 'test@example.com');
    await page.fill('input[placeholder="设置密码"]', 'password123');

    await expect(page.locator('input[placeholder="设置用户名"]')).toHaveValue('testuser');
  });

  test('密码过短显示验证错误', async ({ page }) => {
    await page.fill('input[placeholder="设置用户名"]', 'testuser');
    await page.fill('input[placeholder="admin@example.com"]', 'test@example.com');
    await page.fill('input[placeholder="设置密码"]', '123');
    
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: '创建账户' });
    await submitButton.click();
    
    await expect(page.locator('.ant-form-item-explain-error').filter({ hasText: /密码/ })).toBeVisible();
  });

  test('用户名过短显示验证错误', async ({ page }) => {
    await page.fill('input[placeholder="设置用户名"]', 'ab');
    await page.fill('input[placeholder="admin@example.com"]', 'test@example.com');
    await page.fill('input[placeholder="设置密码"]', 'password123');
    
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: '创建账户' });
    await submitButton.click();
    
    await expect(page.locator('.ant-form-item-explain-error').filter({ hasText: /用户名/ })).toBeVisible();
  });
});

test.describe('认证流程', () => {
  test('注册成功后自动跳转到仪表盘', async ({ page }) => {
    await page.goto('/login');
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    
    const uniqueEmail = `test_${Date.now()}@example.com`;
    await page.fill('input[placeholder="设置用户名"]', 'newuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    
    const submitButton = page.locator('button[type="submit"]').filter({ hasText: '创建账户' });
    await submitButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('未登录访问受保护路由重定向到登录页', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('登录后访问受保护路由成功', async ({ page }) => {
    await page.goto('/login');
    
    const uniqueEmail = `test_${Date.now()}@example.com`;
    await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
    await page.fill('input[placeholder="设置用户名"]', 'newuser');
    await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="设置密码"]', 'password123');
    await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page.locator('h1').filter({ hasText: '仪表盘' })).toBeVisible();
  });
});