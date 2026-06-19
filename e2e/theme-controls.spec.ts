import { expect, type Page, test } from 'playwright/test';

async function gotoReady(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
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
			const lightOption = document.querySelector<HTMLInputElement>('[data-theme-option="light"]');
			if (lightOption === null) {
				throw new Error('Missing light theme option input');
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
	await expect(lightOption).toBeChecked();
	await expect(darkOption).not.toBeChecked();
	await expect(systemOption).not.toBeChecked();
});

test('theme hotkey ignores repeat and contentEditable targets', async ({ page }) => {
	await gotoReady(page);

	const drawer = page.locator('[data-theme-drawer]');
	await expect(drawer).toBeHidden();

	await page.evaluate(() => {
		// Synthetic event needed: Playwright keyboard API cannot set repeat=true.
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

test('theme URL override locks and hides theme controls', async ({ page }) => {
	await gotoReady(page, '/?theme=dark');

	const html = page.locator('html');
	const trigger = page.locator('[data-theme-dock-toggle]');
	const drawer = page.locator('[data-theme-drawer]');

	await expect(html).toHaveAttribute('data-theme-locked', 'true');
	await expect(trigger).toBeHidden();
	await expect(drawer).toBeHidden();
});

test('theme controls are unlocked and trigger is visible without URL override', async ({ page }) => {
	await gotoReady(page);

	const html = page.locator('html');
	const trigger = page.locator('[data-theme-dock-toggle]');

	await expect(html).not.toHaveAttribute('data-theme-locked');
	await expect(trigger).toBeVisible();
});

test('reduced-motion suppresses drawer animation and storm canvas visibility', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await gotoReady(page, '/?calm=off');

	const drawer = page.locator('[data-theme-drawer]');
	const trigger = page.locator('[data-theme-dock-toggle]');
	await trigger.click();
	await expect(drawer).toBeVisible();

	const drawerAnimationName = await drawer.evaluate((element) => getComputedStyle(element).animationName);
	expect(drawerAnimationName).toBe('none');

	const stormCanvasState = await page.evaluate(() => {
		const canvas = document.querySelector<HTMLElement>('.storm-canvas');
		if (canvas === null) {
			throw new Error('Missing .storm-canvas');
		}

		const styles = getComputedStyle(canvas);
		return {
			opacity: Number.parseFloat(styles.opacity),
			visibility: styles.visibility,
		};
	});

	expect(stormCanvasState).toEqual({ opacity: 0, visibility: 'hidden' });
});

test('theme radiogroup arrow keys update selection, roving tabindex, and escape', async ({ page }) => {
	await gotoReady(page);

	const drawer = page.locator('[data-theme-drawer]');
	const trigger = page.locator('[data-theme-dock-toggle]');
	const systemOption = page.locator('[data-theme-option="system"]');
	const darkOption = page.locator('[data-theme-option="dark"]');
	const lightOption = page.locator('[data-theme-option="light"]');

	await page.keyboard.press('t');
	await expect(drawer).toBeVisible();

	await expect(systemOption).toBeChecked();
	await expect(systemOption).toHaveAttribute('tabindex', '0');

	await systemOption.focus();
	await page.keyboard.press('ArrowRight');
	await expect(darkOption).toBeChecked();
	await expect(systemOption).not.toBeChecked();
	await expect(darkOption).toHaveAttribute('tabindex', '0');
	await expect(systemOption).toHaveAttribute('tabindex', '-1');
	await expect(darkOption).toBeFocused();

	// Wrap-around nav check: control order systemOption -> darkOption -> lightOption, so ArrowLeft from systemOption should wrap to lightOption; assertions verify checked state, tabindex, and focus.
	await systemOption.focus();
	await page.keyboard.press('ArrowLeft');
	await expect(lightOption).toBeChecked();
	await expect(darkOption).not.toBeChecked();
	await expect(lightOption).toHaveAttribute('tabindex', '0');
	await expect(darkOption).toHaveAttribute('tabindex', '-1');
	await expect(lightOption).toBeFocused();

	await page.keyboard.press('Escape');
	await expect(drawer).toBeHidden();
	await expect(trigger).toBeFocused();
});

test('calm URL override toggles body calm-mode class', async ({ page }) => {
	const body = page.locator('body');

	await gotoReady(page, '/?calm=on');
	await expect(body).toHaveClass(/(^|\s)calm-mode(\s|$)/);

	await gotoReady(page, '/?calm=off');
	await expect(body).not.toHaveClass(/(^|\s)calm-mode(\s|$)/);
});
