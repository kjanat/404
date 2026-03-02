import { expect, type Page, test } from 'playwright/test';

async function gotoReady(page: Page): Promise<void> {
	await page.goto('/');
	await page.waitForFunction(() => document.body.classList.contains('page-ready'));
}

test('theme option click writes preference once', async ({ page }) => {
	await gotoReady(page);
	const html = page.locator('html');
	const lightOption = page.locator('[data-theme-option="light"]');
	const darkOption = page.locator('[data-theme-option="dark"]');
	const systemOption = page.locator('[data-theme-option="system"]');

	const setCalls = await page.evaluate(() => {
		const isStorageSetItem = (value: unknown): value is Storage['setItem'] => typeof value === 'function';
		const originalSetItemDescriptor = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem');
		if (originalSetItemDescriptor === undefined || !isStorageSetItem(originalSetItemDescriptor.value)) {
			throw new Error('Missing Storage.prototype.setItem descriptor');
		}

		const originalSetItem = originalSetItemDescriptor.value;
		let calls = 0;

		Storage.prototype.setItem = function(this: Storage, key: string, value: string): void {
			calls += 1;
			originalSetItem.call(this, key, value);
		};

		try {
			const lightOption = document.querySelector<HTMLButtonElement>('[data-theme-option="light"]');
			if (lightOption === null) {
				throw new Error('Missing light theme option button');
			}

			lightOption.click();
			return calls;
		} finally {
			Storage.prototype.setItem = originalSetItem;
		}
	});

	expect(setCalls).toBe(1);
	await expect(html).toHaveAttribute('data-theme', 'light');
	await expect(html).toHaveAttribute('data-theme-preference', 'light');
	await expect(lightOption).toHaveAttribute('aria-checked', 'true');
	await expect(darkOption).toHaveAttribute('aria-checked', 'false');
	await expect(systemOption).toHaveAttribute('aria-checked', 'false');
});

test('theme hotkey ignores repeat and contentEditable targets', async ({ page }) => {
	await gotoReady(page);

	const drawer = page.locator('[data-theme-drawer]');
	await expect(drawer).toBeHidden();

	await page.evaluate(() => {
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 't', repeat: true, bubbles: true }));
	});
	await expect(drawer).toBeHidden();

	await page.keyboard.press('t');
	await expect(drawer).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(drawer).toBeHidden();

	await page.evaluate(() => {
		const editable = document.createElement('div');
		editable.setAttribute('contenteditable', 'true');
		editable.setAttribute('data-test-editable', 'true');
		editable.textContent = 'editable';
		editable.tabIndex = 0;
		document.body.appendChild(editable);
		editable.focus();
	});

	await page.keyboard.press('t');
	await expect(drawer).toBeHidden();
});
