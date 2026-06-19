import { expect, type Page, test } from 'playwright/test';

async function gotoReady(page: Page, path = '/'): Promise<void> {
	await page.goto(path);
	await page.waitForFunction(() => document.body.classList.contains('page-ready'));
}

async function canvasHasVisibleStormFrame(page: Page): Promise<boolean> {
	return await page.evaluate(() => {
		const canvas = document.querySelector<HTMLCanvasElement>('.storm-canvas');
		if (canvas === null || canvas.width <= 0 || canvas.height <= 0) return false;

		const gl = canvas.getContext('webgl2');
		if (gl === null) return false;

		const pixel = new Uint8Array(4);
		let minLuma = Number.POSITIVE_INFINITY;
		let maxLuma = Number.NEGATIVE_INFINITY;
		let opaqueSamples = 0;

		for (let y = 1; y <= 4; y++) {
			for (let x = 1; x <= 4; x++) {
				const px = Math.floor((canvas.width * x) / 5);
				const py = Math.floor((canvas.height * y) / 5);
				gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

				const red = pixel[0] ?? 0;
				const green = pixel[1] ?? 0;
				const blue = pixel[2] ?? 0;
				const alpha = pixel[3] ?? 0;
				const luma = red + green + blue;
				minLuma = Math.min(minLuma, luma);
				maxLuma = Math.max(maxLuma, luma);
				if (alpha > 0) opaqueSamples++;
			}
		}

		return opaqueSamples >= 12 && maxLuma - minLuma > 10;
	});
}

test('WebGL storm canvas initializes and draws a nonblank frame', async ({ page }) => {
	await gotoReady(page, '/?calm=off&theme=dark&storm-test=1');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-storm-renderer', 'webgl2');
	await expect(canvas).toHaveAttribute('data-storm-active', 'true');

	await expect.poll(async () => await canvasHasVisibleStormFrame(page)).toBe(true);
});

test('calm mode stops and hides the storm canvas', async ({ page }) => {
	await gotoReady(page, '/?calm=on&theme=dark');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toHaveAttribute('data-storm-active', 'false');

	const canvasState = await canvas.evaluate((element) => {
		const styles = getComputedStyle(element);
		return {
			opacity: Number.parseFloat(styles.opacity),
			visibility: styles.visibility,
		};
	});

	expect(canvasState).toEqual({ opacity: 0, visibility: 'hidden' });
});

test('theme changes update the storm renderer theme', async ({ page }) => {
	await gotoReady(page, '/?calm=off');

	const canvas = page.locator('.storm-canvas');
	await expect(canvas).toHaveAttribute('data-storm-renderer', 'webgl2');

	await page.keyboard.press('t');
	await page.locator('[data-theme-option="light"]').click();

	await expect(canvas).toHaveAttribute('data-storm-theme', 'light');
});
