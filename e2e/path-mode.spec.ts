import { expect, type Page, test } from 'playwright/test';

async function gotoReady(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
	await page.waitForFunction(() => document.body.classList.contains('page-ready'));
}

test('domain mode keeps the escape-hatch row hidden', async ({ page }) => {
	await gotoReady(page, '/');
	await expect(page.locator('[data-escape-hatches]')).toBeHidden();
});

test('forced path mode reveals climb-up links for a deep path', async ({ page }) => {
	await gotoReady(page, '/?mode=path&host=example.com&path=/docs/old/page');

	const hatches = page.locator('[data-escape-hatches]');
	await expect(hatches).toBeVisible();

	const links = hatches.locator('.escape-hatch');
	await expect(links).toHaveCount(2);
	await expect(links.nth(0)).toHaveAttribute('href', '/docs/old/');
	await expect(links.nth(1)).toHaveAttribute('href', '/');
});

test('path-mode blurb names the missing path', async ({ page }) => {
	await gotoReady(page, '/?mode=path&host=example.com&path=/docs/old/page');
	await expect(page.locator('[data-blurb]')).toContainText('/docs/old/page');
});
