import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '..', 'playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.locator('.ant-tabs-tab').filter({ hasText: '注册' }).click();
  
  const uniqueEmail = `e2e_${Date.now()}@example.com`;
  await page.fill('input[placeholder="设置用户名"]', 'e2euser');
  await page.fill('input[placeholder="admin@example.com"]', uniqueEmail);
  await page.fill('input[placeholder="设置密码"]', 'password123');
  await page.locator('button[type="submit"]').filter({ hasText: '创建账户' }).click();
  
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  await page.context().storageState({ path: authFile });
});